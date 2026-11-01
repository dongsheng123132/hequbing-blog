#!/usr/bin/env node
/**
 * AI 案例内容采集脚本
 *
 * 数据源：RSS 订阅（36kr, 机器之心, 量子位, InfoQ 等）
 * 流程：抓取文章 → 筛选企业AI案例 → Claude API 改写 → 写入 cases.json
 *
 * 使用：node scripts/collector.js
 * 环境变量：ANTHROPIC_API_KEY
 */

const fs = require('fs');
const path = require('path');
const { processArticle } = require('./ai-processor');

const CASES_PATH = path.join(__dirname, '..', 'data', 'cases.json');

// RSS 数据源列表
const RSS_SOURCES = [
  {
    name: '36kr AI',
    url: 'https://36kr.com/feed',
    category: 'tech_news'
  },
  {
    name: '机器之心',
    url: 'https://www.jiqizhixin.com/rss',
    category: 'ai_research'
  },
  {
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    category: 'ai_news'
  },
  {
    name: 'InfoQ AI',
    url: 'https://www.infoq.cn/feed',
    category: 'tech_practice'
  }
];

/**
 * 简单 RSS 解析（提取 title, link, description）
 */
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const desc = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                  itemXml.match(/<description>(.*?)<\/description>/) || [])[1] || '';
    if (title && link) {
      items.push({ title: title.trim(), link: link.trim(), description: desc.trim() });
    }
  }
  return items;
}

/**
 * 抓取单个 RSS 源
 */
async function fetchRSS(source) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'HequbingBot/1.0' }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSSItems(xml);
    console.log(`[${source.name}] 获取到 ${items.length} 篇文章`);
    return items.map(item => ({ ...item, source: source.name }));
  } catch (e) {
    console.error(`[${source.name}] 抓取失败: ${e.message}`);
    return [];
  }
}

/**
 * 加载现有案例
 */
function loadExistingCases() {
  try {
    const raw = fs.readFileSync(CASES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 保存案例到文件
 */
function saveCases(cases) {
  fs.writeFileSync(CASES_PATH, JSON.stringify(cases, null, 2), 'utf-8');
  console.log(`已保存 ${cases.length} 个案例到 ${CASES_PATH}`);
}

/**
 * 检查文章是否已被采集（基于标题相似度）
 */
function isDuplicate(title, existingCases) {
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, '');
  return existingCases.some(c => {
    const existing = c.title.toLowerCase().replace(/\s+/g, '');
    return existing === normalizedTitle || existing.includes(normalizedTitle) || normalizedTitle.includes(existing);
  });
}

/**
 * 主流程
 */
async function main() {
  console.log('=== AI 案例采集开始 ===');
  console.log(`时间: ${new Date().toISOString()}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('错误: 请设置环境变量 ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // 1. 抓取所有 RSS 源
  const allArticles = [];
  for (const source of RSS_SOURCES) {
    const items = await fetchRSS(source);
    allArticles.push(...items);
  }
  console.log(`\n共获取 ${allArticles.length} 篇文章`);

  if (allArticles.length === 0) {
    console.log('没有获取到文章，退出');
    return;
  }

  // 2. 加载现有案例
  const existingCases = loadExistingCases();
  const maxId = existingCases.reduce((max, c) => Math.max(max, c.id || 0), 0);
  let nextId = maxId + 1;

  // 3. 用 AI 处理每篇文章
  let newCases = 0;
  for (const article of allArticles) {
    // 跳过重复
    if (isDuplicate(article.title, existingCases)) {
      continue;
    }

    try {
      const result = await processArticle(article);
      if (result && result.is_enterprise_case) {
        const newCase = {
          id: nextId++,
          slug: result.slug,
          title: result.title,
          date: new Date().toISOString().split('T')[0],
          industry: result.industry,
          scenario: result.scenario,
          tags: result.tags,
          summary: result.summary,
          content: result.content,
          source: article.source,
          source_url: article.link,
          hot_score: result.hot_score
        };
        existingCases.push(newCase);
        newCases++;
        console.log(`[新增] ${newCase.title} (热度: ${newCase.hot_score})`);
      }
    } catch (e) {
      console.error(`[跳过] ${article.title}: ${e.message}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  // 4. 保存
  if (newCases > 0) {
    saveCases(existingCases);
    console.log(`\n新增 ${newCases} 个案例`);
  } else {
    console.log('\n没有新案例');
  }

  console.log('=== 采集完成 ===');

  // 5. 发送 Telegram 通知
  if (newCases > 0 && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const msg = `🤖 AI 案例采集完成\n新增 ${newCases} 个案例\n总计 ${existingCases.length} 个案例`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg })
      });
    } catch (e) {
      console.error('Telegram 通知失败:', e.message);
    }
  }
}

main().catch(e => {
  console.error('采集失败:', e);
  process.exit(1);
});
