#!/usr/bin/env node
/**
 * 给构建产物补 canonical（只补缺的，不动已有的）
 *
 * 为什么需要：/observe 与 /observe/rankings 是独立应用（来自 modules/observe 子模块），
 * 它们的 HTML 模板不带 canonical；线上这两个页面因此被 Google 当成「没有规范标记的重复页」。
 * 本脚本在 build 末尾扫一遍 public/**\/*.html，缺 canonical 的按路径补一条自指 canonical。
 *
 * 规则：
 * - 已经写了 canonical 的页面一律跳过（文章页 / 主站页 / archive / tags 都有）；
 * - public/old/** 跳过（那是旧版存档，故意 noindex）；
 * - canonical 用 https://www.hequbing.com + 路径，不带尾斜杠（根为 /），
 *   与 Vercel cleanUrls + trailingSlash:false 的线上最终 URL 一致。
 *
 * 用法：node scripts/inject-canonical.js（已挂在 npm run build 末尾）
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SITE = 'https://www.hequbing.com';
const SKIP_DIRS = new Set(['old']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function urlFor(file) {
  let rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
  rel = rel.replace(/index\.html$/, '').replace(/\.html$/, '');
  if (rel === '') return SITE + '/';
  return SITE + '/' + rel.replace(/\/$/, '');
}

const files = walk(PUBLIC_DIR);
let added = 0;
let skipped = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf-8');
  if (!/<head[^>]*>/i.test(html)) continue;
  if (/<link[^>]+rel=["']canonical["']/i.test(html)) {
    skipped++;
    continue;
  }
  const url = urlFor(file);
  const tag = `<link rel="canonical" href="${url}" />`;
  const patched = html.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}>\n${tag}`);
  if (patched === html) continue;
  fs.writeFileSync(file, patched, 'utf-8');
  added++;
  console.log(`canonical + ${url}  (${path.relative(PUBLIC_DIR, file)})`);
}

console.log(`inject-canonical: added ${added}, already had ${skipped}`);
