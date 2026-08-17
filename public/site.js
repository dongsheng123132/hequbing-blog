/**
 * 全站共享脚本：页脚年份 / 微信悬浮窗 / 返回顶部 / 平滑滚动
 * 所有页面统一引入本文件，避免重复代码。
 */
(function () {
  'use strict';

  // 微信号的前端唯一真相源。
  // 曾经 5 个页面各硬编码一份，导致官网长期显示 hequbing_ai、
  // 而 u-claw 那边是 hecare888 —— 同一个人两个号，买家会犹豫。
  // 以后改号只改这一行；各页面 HTML 里的字面值只作为无 JS 时的兜底。
  var WECHAT_ID = 'hecare888';

  // 1. 页脚年份
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 1.5 把微信号统一写进所有展示位
  var codeEls = document.querySelectorAll('.contact-code strong, [data-wechat-id]');
  for (var i = 0; i < codeEls.length; i++) codeEls[i].textContent = WECHAT_ID;

  // 2. 微信悬浮窗
  function toggleWechat() {
    var popup = document.getElementById('wechat-popup');
    if (popup) popup.classList.toggle('show');
  }
  window.toggleWechat = toggleWechat;

  // 页面任意位置的 [data-wechat-trigger] 都能开弹窗（如首页 hero 的「免费聊 30 分钟」）。
  // 必须在这里放行，否则下面的全局关闭逻辑会把刚打开的弹窗立刻关掉。
  document.addEventListener('click', function (e) {
    if (e.target.closest('.wechat-float') || e.target.closest('[data-wechat-trigger]')) return;
    var popup = document.getElementById('wechat-popup');
    if (popup) popup.classList.remove('show');
  });

  // 3. 返回顶部按钮（JS 注入，页面无需单独写 HTML）
  if (document.body) {
    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.title = '返回顶部';
    btn.innerHTML = '↑';
    btn.setAttribute('aria-label', '返回顶部');
    document.body.appendChild(btn);

    function onScroll() {
      if (window.scrollY > 400) {
        btn.classList.add('show');
      } else {
        btn.classList.remove('show');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
