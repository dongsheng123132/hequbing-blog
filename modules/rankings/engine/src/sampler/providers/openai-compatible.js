/**
 * 通用 OpenAI 兼容采样通道。
 *
 * 大多数国内模型（DeepSeek、Kimi、通义、豆包方舟、以及各类中转）都提供
 * OpenAI 兼容的 /chat/completions，因此一个适配器可以覆盖大部分通道，
 * 差异用 baseURL / model / headers 表达。
 *
 * 零依赖，用 Node 内置 fetch。只有在显式配置代理时才按需加载 undici ——
 * 因为内置 fetch 不认 ProxyAgent，而国内访问海外模型基本都要走代理。
 */

/**
 * @param {object} cfg
 * @param {string} cfg.id 通道标识（写进样本的 engine 字段）
 * @param {string} cfg.baseURL 如 https://api.deepseek.com/v1
 * @param {string} cfg.apiKey
 * @param {string} cfg.model
 * @param {number} [cfg.temperature]
 * @param {number} [cfg.timeoutMs]
 * @param {string} [cfg.proxyUrl] 出口代理，如 http://127.0.0.1:7897
 * @param {Record<string,string>} [cfg.headers]
 * @param {(text:string)=>string} [cfg.postprocess]
 * @returns {import('./index.js').Provider & {model:string}}
 */
export function openAICompatible(cfg) {
  const {
    id,
    baseURL,
    apiKey,
    model,
    temperature = 1.0,
    timeoutMs = 120000,
    proxyUrl,
    headers = {},
    postprocess,
    maxTokens,
  } = cfg;
  if (!baseURL || !apiKey || !model) {
    throw new Error(`采样通道 ${id} 缺少 baseURL / apiKey / model`);
  }
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens <= 0)) throw new Error('maxTokens 必须为正整数');
  let dispatcher;
  let dispatcherResolved = false;
  async function getDispatcher() {
    if (!proxyUrl) return undefined;
    if (dispatcherResolved) return dispatcher;
    let ProxyAgent;
    try {
      ({ ProxyAgent } = await import('undici'));
    } catch {
      throw new Error(
        `采样通道 ${id} 配置了代理但未安装 undici。请执行 npm i undici，或改用 Node 24+ 的 NODE_USE_ENV_PROXY=1。`,
      );
    }
    dispatcher = new ProxyAgent(proxyUrl);
    dispatcherResolved = true;
    return dispatcher;
  }

  return {
    id,
    model,
    channel: 'api',
    async ask(prompt, _ctx) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const dp = await getDispatcher();
        const res = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
            ...headers,
          },
          body: JSON.stringify({
            model,
            ...(temperature === null ? {} : { temperature }),
            ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: ac.signal,
          ...(dp ? { dispatcher: dp } : {}),
        });
        if (!res.ok) {
          throw new Error(`${id} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
          throw new Error(`${id} 返回内容为空`);
        }
        return { text: postprocess ? postprocess(text) : text, model: json.model ?? model,
          usage: json.usage ?? null, finishReason: json.choices?.[0]?.finish_reason ?? null,
          providerRequestId: json.id ?? null };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
