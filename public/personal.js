/** 作品筛选是页面增强；无 JavaScript 时仍展示全部作品。 */
(function () {
  'use strict';
  document.documentElement.classList.add('personal-enhanced');
  var filters = document.querySelector('.work-filters');
  if (!filters) return;
  filters.hidden = false;
  var buttons = filters.querySelectorAll('[data-work-filter]');
  var cards = document.querySelectorAll('[data-work-type]');
  var live = document.querySelector('[data-work-count]');
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var selected = button.getAttribute('data-work-filter');
      var count = 0;
      buttons.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      cards.forEach(function (card) {
        card.hidden = selected !== 'all' && card.getAttribute('data-work-type') !== selected;
        if (!card.hidden) count++;
      });
      if (live) live.textContent = document.documentElement.lang === 'en' ? count + ' projects shown' : '显示 ' + count + ' 件作品';
    });
  });
})();
