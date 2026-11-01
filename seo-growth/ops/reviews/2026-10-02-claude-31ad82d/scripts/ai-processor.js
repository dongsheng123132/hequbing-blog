/**
 * AI 改写 & 分类处理器
 *
 * 用 Claude API 完成：
 * 1. 判断是否为"企业 AI 落地案例"
 * 2. 提取关键信息
 * 3. 改写为专业案例摘要
 * 4. 自动打标签和分类
 * 5. 生成热度评分
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `你是一个 AI 企业案例分析师。你的任务是分析文章，判断是否为"企业 AI 落地案例"，并提取和改写信息。

判断标准 - 以下情况才算"企业 AI 落地案例"：
- 有具体企业名称
- 描述了 AI/大模型/机器学习 在企业中的实际应用
- 有具体的场景和效果（最好有数据）
- 不是纯技术论文、产品发布、融资新闻

如果是企业AI案例，请返回以下 JSON：
{
  "is_enterprise_case": true,
  "title": "改写后的标题，格式：{企业名} {AI应用} {核心效果}",
  "slug": "英文slug，用连字符连接",
  "industry": "行业分类，从以下选择：家电制造/金融保险/医疗健康/零售电商/教育培训/物流运输/餐饮酒店/房地产/农业/其他",
  "scenario": "场景分类，从以下选择：智能客服/内容生成/数据分析/流程自动化/智能推荐/质量检测/文档处理/代码开发/营销获客/其他",
  "tags": ["标签数组，2-4个"],
  "summary": "300字以内的案例摘要，包含企业背景、方案、效果",
  "content": "HTML格式的详细案例分析，包含：背景、解决方案、效果数据、关键启示",
  "hot_score": 0-100的热度分，计算规则：企业知名度(0-30) + 数据亮眼度(0-30) + 时效性(0-20) + 场景通用性(0-20)
}

如果不是企业AI案例，返回：
{ "is_enterprise_case": false }

只返回 JSON，不要其他内容。`;

/**
 * 调用 Claude API 处理单篇文章
 */
async function processArticle(article) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const userMessage = `请分析以下文章，判断是否为企业AI落地案例：

标题：${article.title}
来源：${article.source || '未知'}
内容摘要：${article.description || '无'}
链接：${article.link || ''}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  return JSON.parse(jsonMatch[0]);
}

module.exports = { processArticle };
