'use strict';

// 原图来自本人提供的微信名片；不裁切、不重绘二维码。
const WECHAT_IMAGE = '/images/hequbing-wechat-original.jpg';
const WECHAT_ID = 'hecare888';

function imageLink(english) {
  const label = english ? 'Open the full WeChat QR code' : '点击放大微信二维码';
  return `<a class="wechat-image-link" href="${WECHAT_IMAGE}" data-wechat-image aria-label="${label}"><img src="${WECHAT_IMAGE}" width="888" height="1131" alt="${english ? 'Hequbing’s original WeChat contact QR code' : '贺去病本人提供的微信名片二维码'}" loading="lazy" decoding="async"></a>`;
}

function renderContactCard(english = false) {
  return `<div class="personal-contact-card" data-contact-card>
  ${imageLink(english)}
  <p class="wechat-scan-note">${english ? 'Scan with WeChat · or save and open in WeChat' : '微信扫一扫 · 手机上可保存后在微信识别'}</p>
  <p class="wechat-account">${english ? 'WeChat' : '微信号'} <strong data-wechat-id>${WECHAT_ID}</strong></p>
  <div class="wechat-card-actions"><button type="button" data-copy-wechat>${english ? 'Copy WeChat ID' : '复制微信号'}</button><a href="${WECHAT_IMAGE}" download="hequbing-wechat.jpg">${english ? 'Save QR code' : '保存二维码'}</a></div>
  <p class="wechat-copy-status" data-copy-status aria-live="polite" role="status"></p>
</div>`;
}

function renderLightbox(english) {
  return `<dialog id="wechat-lightbox" class="wechat-lightbox" aria-labelledby="wechat-lightbox-title">
  <div class="wechat-lightbox-bar"><h2 id="wechat-lightbox-title">${english ? 'Connect on WeChat' : '添加贺去病的微信'}</h2><button type="button" data-wechat-close aria-label="${english ? 'Close QR code' : '关闭二维码'}">×</button></div>
  <img src="${WECHAT_IMAGE}" width="888" height="1131" alt="${english ? 'Hequbing’s original WeChat contact QR code' : '贺去病微信名片原图，扫描二维码添加好友'}">
  <p>${english ? 'WeChat ID' : '微信号'}：<strong>${WECHAT_ID}</strong> · <a href="${WECHAT_IMAGE}" download="hequbing-wechat.jpg">${english ? 'Save original image' : '保存原图'}</a></p>
</dialog>`;
}

// 旧页面的占位元素含嵌套 div，按层级替换，避免留下多余的闭合标签。
function replaceLegacyPlaceholder(html, english) {
  const opening = /<div\b[^>]*\bclass="[^"]*\bqr-placeholder\b[^"]*"[^>]*>/g;
  let match;
  while ((match = opening.exec(html))) {
    const tags = /<\/?div\b[^>]*>/g;
    tags.lastIndex = opening.lastIndex;
    let depth = 1;
    let tag;
    while ((tag = tags.exec(html)) && depth) {
      depth += /^<\//.test(tag[0]) ? -1 : 1;
      if (!depth) break;
    }
    if (depth) throw new Error('Unclosed QR placeholder');
    const replacement = `<div class="wechat-qr-frame">${imageLink(english)}</div><div class="wechat-popup-actions" data-contact-card><p class="wechat-account">${english ? 'WeChat' : '微信号'} <strong data-wechat-id>${WECHAT_ID}</strong></p><div class="wechat-card-actions"><button type="button" data-copy-wechat>${english ? 'Copy WeChat ID' : '复制微信号'}</button><a href="${WECHAT_IMAGE}" download="hequbing-wechat.jpg">${english ? 'Save QR code' : '保存二维码'}</a></div><p data-copy-status aria-live="polite" role="status"></p></div>`;
    html = html.slice(0, match.index) + replacement + html.slice(tags.lastIndex);
    opening.lastIndex = match.index + replacement.length;
  }
  return html;
}

function enhanceContactHtml(input) {
  const english = /<html\b[^>]*\blang="en(?:-[^"]*)?"/i.test(input);
  let html = replaceLegacyPlaceholder(input, english);
  if (english && !html.includes('<!-- AUTO:CONTACT:START -->')) {
    html = html.replace('</main>', `<section class="wechat-inline-contact"><div><h2>Let’s talk about your next step.</h2><p>Scan the QR code or copy my WeChat ID to start a conversation.</p></div><!-- AUTO:CONTACT:START --><!-- AUTO:CONTACT:END --></section>\n  </main>`);
  }
  html = html.replace(/<!-- AUTO:CONTACT:START -->[\s\S]*?<!-- AUTO:CONTACT:END -->/g,
    `<!-- AUTO:CONTACT:START -->\n${renderContactCard(english)}\n<!-- AUTO:CONTACT:END -->`);
  if (!/data-wechat-image|id="wechat-popup"/.test(html)) return html;
  if (!/href="\/contact\.css"/.test(html)) html = html.replace('</head>', '  <link rel="stylesheet" href="/contact.css">\n</head>');
  if (!html.includes('id="wechat-lightbox"')) html = html.replace('</body>', renderLightbox(english) + '\n</body>');
  if (!html.includes('data-wechat-popup-close')) {
    html = html.replace(/(<div\b[^>]*\bid="wechat-popup"[^>]*>)/,
      `$1<button type="button" class="wechat-popup-close" data-wechat-popup-close aria-label="${english ? 'Close WeChat contact' : '关闭微信联系窗口'}">×</button>`);
  }
  return html;
}

module.exports = { WECHAT_IMAGE, WECHAT_ID, renderContactCard, enhanceContactHtml };
