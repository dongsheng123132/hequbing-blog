import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

/** 复用本机 bl 的鉴权；不在参数、样本或仓库中复制凭据。 */
export function bailianCLI({ id, model, cliPath, maxTokens = 8192, timeoutMs = 180000 }) {
  if (!id || !model || !cliPath) throw new Error('百炼通道缺少 id、model 或 CLI 路径');
  const env = { ...process.env };
  // Node 24 默认不读取 HTTP(S)_PROXY；复用已配置代理，不写入全局配置。
  if (Number(process.versions.node.split('.')[0]) >= 24 && env.NODE_USE_ENV_PROXY === undefined && (env.HTTPS_PROXY || env.HTTP_PROXY)) env.NODE_USE_ENV_PROXY = '1';
  return {
    id, model, channel: 'api', networkRoute: env.NODE_USE_ENV_PROXY === '1' ? 'configured_proxy' : 'runtime_default',
    async ask(prompt) {
      const args = [cliPath, '--output', 'json', '--timeout', String(Math.floor(timeoutMs / 1000)),
        'text', 'chat', '--model', model, '--message', prompt, '--max-tokens', String(maxTokens)];
      // stdout 为管道时 CLI 默认非流式；当前版本不支持 --no-stream。
      // --quiet 会把 JSON 降成纯文本，丢失 usage / finish_reason，禁止在这里添加。
      let stdout;
      try {
        ({ stdout } = await execute(process.execPath, args, { env, timeout: timeoutMs + 5000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }));
      } catch (error) {
        // execFile 原始异常含命令/环境信息，不直接写入样本。
        const timedOut = error.killed || error.signal;
        throw new Error(timedOut ? '百炼 CLI 请求超时，费用待账单核对' : `百炼 CLI 请求失败（退出码 ${error.code ?? 'unknown'}），请核对通道`);
      }
      const result = JSON.parse(stdout);
      const choice = result.choices?.[0];
      if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('百炼返回内容为空');
      return { text: choice.message.content, model: result.model ?? model, usage: result.usage ?? null,
        finishReason: choice.finish_reason ?? null, providerRequestId: result.id ?? null };
    },
  };
}
