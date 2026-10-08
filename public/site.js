/** 全站共享交互：真实微信名片、复制、图片查看、导航与返回顶部。 */
(function () {
  'use strict';
  var WECHAT_ID = 'hecare888';
  var english = /^en\b/i.test(document.documentElement.lang);
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  document.querySelectorAll('.contact-code strong, [data-wechat-id]').forEach(function (el) { el.textContent = WECHAT_ID; });

  var popup = document.getElementById('wechat-popup');
  var popupOpener = null;
  var imageOpener = null;
  var boundDialog = null;
  var popupTriggers = '.wechat-float-btn, [data-wechat-trigger], [onclick*="toggleWechat"]';
  if (popup) {
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', english ? 'WeChat contact' : '微信联系');
    popup.hidden = !popup.classList.contains('show');
  }
  function syncTriggers(open) {
    document.querySelectorAll(popupTriggers).forEach(function (el) {
      el.setAttribute('aria-controls', 'wechat-popup');
      el.setAttribute('aria-expanded', String(open));
    });
  }
  syncTriggers(false);
  function setPopup(open, opener, restoreFocus) {
    if (!popup) return;
    if (open) popupOpener = opener || document.activeElement;
    popup.hidden = !open;
    popup.classList.toggle('show', open);
    syncTriggers(open);
    if (open) {
      var close = popup.querySelector('[data-wechat-popup-close]');
      if (close) close.focus();
    } else if (restoreFocus && popupOpener && popupOpener.isConnected) popupOpener.focus();
  }
  // 保留旧页面 onclick="toggleWechat()"，外层点击委托不会再次切换同一次点击。
  window.toggleWechat = function (opener) { setPopup(popup ? popup.hidden : false, opener, true); };

  function imageDialog() {
    var dialog = document.getElementById('wechat-lightbox');
    if (dialog && dialog !== boundDialog) {
      dialog.addEventListener('close', function () {
        if (imageOpener && imageOpener.isConnected) imageOpener.focus();
      });
      boundDialog = dialog;
    }
    return dialog;
  }

  function reportCopy(button, message) {
    var card = button.closest('[data-contact-card]');
    var status = card && card.querySelector('[data-copy-status]');
    if (status) status.textContent = message;
  }
  async function copyWechat(button) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(WECHAT_ID);
      reportCopy(button, english ? 'Copied. Paste it into WeChat search.' : '已复制，可在微信搜索框粘贴。');
    } catch (_) {
      reportCopy(button, english ? 'Copy unavailable. Select and copy hecare888 manually.' : '复制未成功，请手动选中并复制 hecare888。');
    } finally { button.disabled = false; }
  }

  var menuToggle = document.querySelector('[data-menu-toggle]');
  var menu = menuToggle && document.getElementById(menuToggle.getAttribute('aria-controls'));
  if (menu) menuToggle.hidden = false;
  function setMenu(open) {
    if (!menu || !menuToggle) return;
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var copy = target.closest('[data-copy-wechat]');
    if (copy) { event.preventDefault(); copyWechat(copy); return; }
    var image = target.closest('[data-wechat-image]');
    if (image) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var dialog = imageDialog();
      if (dialog && typeof dialog.showModal === 'function') {
        event.preventDefault();
        imageOpener = popup && popup.contains(image) ? popupOpener : image;
        setPopup(false, null, false);
        if (!dialog.open) dialog.showModal();
      }
      return;
    }
    if (target.closest('[data-wechat-close]')) {
      var opened = imageDialog();
      if (opened) opened.close();
      return;
    }
    var backdropDialog = imageDialog();
    if (backdropDialog && target === backdropDialog && backdropDialog.open) {
      var rect = backdropDialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) backdropDialog.close();
      return;
    }
    if (target.closest('[data-wechat-popup-close]')) { setPopup(false, null, true); return; }
    var trigger = target.closest(popupTriggers);
    if (trigger) {
      if (!trigger.getAttribute('onclick')) {
        event.preventDefault();
        window.toggleWechat(trigger);
      }
      return;
    }
    if (popup && !popup.contains(target)) setPopup(false, null, false);
    if (menuToggle && (target === menuToggle || menuToggle.contains(target))) {
      setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    } else if (menu && target.closest('a') && menu.contains(target)) setMenu(false);
    else if (menu && !menu.contains(target)) setMenu(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (popup && !popup.hidden) { setPopup(false, null, true); event.preventDefault(); }
    if (menu && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
    // 原生 dialog 自带 Escape、焦点约束与背景不可交互行为。
  });

  if (document.body) {
    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.title = english ? 'Back to top' : '返回顶部';
    btn.textContent = '↑';
    btn.setAttribute('aria-label', btn.title);
    document.body.appendChild(btn);
    function onScroll() { btn.classList.toggle('show', window.scrollY > 400); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
    });
  }
})();
