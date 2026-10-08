'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { enhanceContactHtml, WECHAT_IMAGE } = require('../scripts/contact-block');
const root = path.join(__dirname, '..');

test('微信名片保留用户原文件字节，静态页面无脚本也能打开完整图片', () => {
  const original = fs.readFileSync(path.join(root, 'public', WECHAT_IMAGE));
  assert.equal(createHash('sha256').update(original).digest('hex'), '2f4dc8cbb2261936742c3da67224d6b22bed52acd7e95fdf8c81b84b91bcef8d');
  const html = enhanceContactHtml('<html lang="zh-CN"><head></head><body><main><!-- AUTO:CONTACT:START --><!-- AUTO:CONTACT:END --></main></body></html>');
  assert.ok(html.includes(`href="${WECHAT_IMAGE}" data-wechat-image`));
  assert.ok(html.includes('width="888" height="1131"'));
  assert.ok(html.includes('download="hequbing-wechat.jpg"'));
  assert.equal(enhanceContactHtml(html), html);
  assert.equal((html.match(/id="wechat-lightbox"/g) || []).length, 1);
});

test('旧占位块嵌套替换保留上下文，双语增强不会重复累加', () => {
  const source = '<html lang="zh-CN"><head></head><body><div id="wechat-popup"><h4>咨询</h4><div class="qr-placeholder"><div class="contact-code">微信号<br><strong>hecare888</strong></div></div><p>发送公司名</p></div><p>页尾</p></body></html>';
  const html = enhanceContactHtml(source);
  assert.ok(!html.includes('qr-placeholder'));
  assert.ok(html.includes('<p>发送公司名</p></div><p>页尾</p>'));
  assert.equal(enhanceContactHtml(html), html);
  const en = enhanceContactHtml('<html lang="en"><head></head><body><main>Services</main></body></html>');
  assert.ok(en.includes('Copy WeChat ID'));
  assert.ok(en.includes('Scan the QR code'));
  assert.equal(enhanceContactHtml(en), en);
  assert.throws(() => enhanceContactHtml('<div class="qr-placeholder"><div>Broken'), /Unclosed QR placeholder/);
});

function client({ clipboard } = {}) {
  let focused;
  function element(selectors = []) {
    const attrs = {};
    const classes = new Set();
    return {
      selectors, isConnected: true, disabled: false,
      classList: { contains: c => classes.has(c), toggle: (c, state) => state ? classes.add(c) : classes.delete(c) },
      closest(selector) { return selector.split(', ').some(s => selectors.includes(s)) ? this : null; },
      setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k] || null,
      contains: child => child === this,
      querySelector: () => null,
      focus() { focused = this; },
    };
  }
  const opener = element(['[onclick*="toggleWechat"]']);
  opener.setAttribute('onclick', 'toggleWechat()');
  const close = element(['[data-wechat-popup-close]']);
  const popup = element();
  popup.querySelector = () => close;
  popup.contains = target => target === close || target === popup;
  const status = { textContent: '' };
  const card = { querySelector: () => status };
  const copy = element(['[data-copy-wechat]']);
  copy.closest = s => s === '[data-contact-card]' ? card : (s === '[data-copy-wechat]' ? copy : null);
  const callbacks = {};
  const document = {
    body: null, activeElement: opener, documentElement: { lang: 'zh-CN' },
    getElementById: id => id === 'wechat-popup' ? popup : null,
    querySelectorAll: selector => selector.includes('toggleWechat') ? [opener] : [],
    querySelector: () => null,
    addEventListener: (name, fn) => { callbacks[name] = fn; },
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/site.js'), 'utf8'), { document, window, navigator: { clipboard } });
  function click(target) { callbacks.click({ target, preventDefault() {} }); }
  return { popup, opener, close, copy, status, window, click, element, key: key => callbacks.keydown({ key, preventDefault() {} }), focused: () => focused };
}

test('旧按钮打开后不会被同一次冒泡立即关闭，Esc 恢复触发按钮焦点', () => {
  const c = client();
  c.window.toggleWechat();
  c.click(c.opener);
  assert.equal(c.popup.hidden, false);
  assert.equal(c.focused(), c.close);
  assert.equal(c.opener.getAttribute('aria-expanded'), 'true');
  c.click(c.popup);
  assert.equal(c.popup.hidden, false);
  c.key('Escape');
  assert.equal(c.popup.hidden, true);
  assert.equal(c.focused(), c.opener);
  c.window.toggleWechat(c.opener);
  c.click(c.element());
  assert.equal(c.popup.hidden, true);
});

test('剪贴板失败不会假报已复制，按钮恢复可用且保留手动复制微信号', async () => {
  const denied = client({ clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } });
  denied.click(denied.copy);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(denied.status.textContent, /未成功.*hecare888/);
  assert.equal(denied.copy.disabled, false);
  let copied;
  const allowed = client({ clipboard: { writeText: async value => { copied = value; } } });
  allowed.click(allowed.copy);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(copied, 'hecare888');
  assert.match(allowed.status.textContent, /已复制/);
  assert.equal(allowed.copy.disabled, false);
  const missing = client();
  missing.click(missing.copy);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(missing.status.textContent, /未成功/);
});
