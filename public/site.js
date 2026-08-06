/**
 * 全站共享脚本：页脚年份 / 微信悬浮窗 / 返回顶部 / 平滑滚动
 * 所有页面统一引入本文件，避免重复代码。
 */
(function () {
  'use strict';

  // 1. 页脚年份
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 2. 微信悬浮窗
  function toggleWechat() {
    var popup = document.getElementById('wechat-popup');
    if (popup) popup.classList.toggle('show');
  }
  window.toggleWechat = toggleWechat;

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.wechat-float')) {
      var popup = document.getElementById('wechat-popup');
      if (popup) popup.classList.remove('show');
    }
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
