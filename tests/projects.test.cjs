'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { projects } = require('../lib/project-catalog');
const { renderPersonal } = require('../lib/personal-pages');

const root = path.join(__dirname, '..');
const pages = ['index.html', 'about.html', 'en/index.html', 'en/about.html'];
const types = ['product', 'protocol', 'research', 'experiment'];
const script = fs.readFileSync(path.join(root, 'public/personal.js'), 'utf8');

function attributes(text) {
  const result = {};
  for (const match of text.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

// Extract the actual card bindings from the built pages, including compact cards.
function projectCards(html) {
  const result = [];
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const attrs = attributes(match[2]);
    if (!Object.hasOwn(attrs, 'data-project-id')) continue;
    const end = html.indexOf('</' + match[1] + '>', match.index + match[0].length);
    assert.notEqual(end, -1, 'Project card must have a closing tag: ' + attrs['data-project-id']);
    result.push({ attrs, html: html.slice(match.index, end + match[1].length + 3) });
  }
  return result;
}

function element(attrs = {}) {
  return {
    attrs: { ...attrs },
    hidden: Object.hasOwn(attrs, 'hidden'),
    listeners: {},
    textContent: '',
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    click() { assert.equal(typeof this.listeners.click, 'function'); this.listeners.click(); },
  };
}

function runFilters(html) {
  const filterTag = Array.from(html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi))
    .find(match => (attributes(match[2]).class || '').split(/\s+/).includes('work-filters'));
  assert.ok(filterTag, 'Page must expose the project filter controls');
  const filters = element(attributes(filterTag[2]));
  const buttons = Array.from(html.matchAll(/<button\b([^>]*)>/gi), match => element(attributes(match[1])))
    .filter(button => Object.hasOwn(button.attrs, 'data-work-filter'));
  const cards = projectCards(html).map(card => element(card.attrs));
  const live = element();
  const classes = new Set();
  filters.querySelectorAll = selector => {
    assert.equal(selector, '[data-work-filter]');
    return buttons;
  };
  const document = {
    documentElement: {
      lang: html.match(/<html\b[^>]*\blang="([^"]+)"/)[1],
      classList: { add(name) { classes.add(name); } },
    },
    querySelector(selector) {
      if (selector === '.work-filters') return filters;
      if (selector === '[data-work-count]') return live;
      return null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-work-type]');
      // Return only nodes the real selector would find, so a missing compact
      // card binding cannot be concealed by the simulated DOM.
      return cards.filter(card => Object.hasOwn(card.attrs, 'data-work-type'));
    },
  };
  vm.runInNewContext(script, { document }, { timeout: 1000 });
  return { filters, buttons, cards, live, classes, lang: document.documentElement.lang };
}

test('项目目录完整且稳定，协议与实验保持各自分类', () => {
  assert.equal(projects.length, 18);
  assert.equal(new Set(projects.map(project => project.id)).size, projects.length);
  assert.deepEqual(projects.filter(project => project.featured).map(project => project.id), projects.slice(0, 6).map(project => project.id));
  assert.equal(projects.filter(project => project.featured).length, 6);
  assert.deepEqual([...new Set(projects.map(project => project.type))].sort(), [...types].sort());
  for (const project of projects) {
    assert.match(project.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(types.includes(project.type), project.id);
  }
  assert.equal(projects.filter(project => /benxiang|本象/i.test(project.id + ' ' + project.name)).length, 1);
});

for (const page of pages) {
  test(page + '：18项静态内容各出现一次，2origin保留官网和源码入口', () => {
    const html = fs.readFileSync(path.join(root, 'public', page), 'utf8');
    const cards = projectCards(html);
    assert.equal(cards.length, 18, page);
    assert.deepEqual(cards.map(card => card.attrs['data-project-id']).sort(), projects.map(project => project.id).sort());
    for (const card of cards) {
      const project = projects.find(item => item.id === card.attrs['data-project-id']);
      assert.equal(card.attrs['data-work-type'], project.type, project.id + ': filter binding');
      assert.ok(!Object.hasOwn(card.attrs, 'hidden'), project.id + ': visible without JavaScript');
      assert.ok(!/\bundefined\b|\[object Object\]/.test(card.html), project.id + ': missing copy');
    }
    const originProject = projects.find(project => /^https:\/\/(?:www\.)?2origin\.org(?:\/|$)/i.test(project.url));
    assert.ok(originProject, '2origin must have an official website entry');
    const origin = cards.find(card => card.attrs['data-project-id'] === originProject.id);
    assert.ok(origin, '2origin must be included');
    const urls = Array.from(origin.html.matchAll(/href="([^"]+)"/g), match => match[1]);
    assert.ok(urls.some(url => /^https:\/\/(?:www\.)?2origin\.org(?:\/|$)/i.test(url)), '2origin official website');
    assert.ok(urls.some(url => /^https:\/\/github\.com\/dongsheng123132\/2origin(?:\/|$)/i.test(url)), '2origin source repository');
    assert.equal(cards.filter(card => /benxiang|本象/i.test(card.attrs['data-project-id'] + ' ' + card.html)).length, 1, 'Benxiang must not be duplicated between featured and compact cards');
  });

}

for (const lang of ['zh-CN', 'en']) {
  test(lang + '首页：分类筛选覆盖全部18张卡，包括紧凑项目和恢复全部', () => {
    const html = renderPersonal('index', lang);
    const state = runFilters(html);
    assert.equal(state.filters.hidden, false);
    assert.deepEqual(state.buttons.map(button => button.getAttribute('data-work-filter')).sort(), ['all', ...types].sort());
    assert.equal(state.cards.length, 18);
    for (const type of [...types, 'all']) {
      const button = state.buttons.find(item => item.getAttribute('data-work-filter') === type);
      button.click();
      const expected = projects.filter(project => type === 'all' || project.type === type).map(project => project.id).sort();
      const visible = state.cards.filter(card => !card.hidden).map(card => card.getAttribute('data-project-id')).sort();
      assert.deepEqual(visible, expected, 'Visible project set for ' + type);
      for (const item of state.buttons) assert.equal(item.getAttribute('aria-pressed'), String(item === button));
      assert.equal(state.live.textContent, state.lang === 'en' ? expected.length + ' projects shown' : '显示 ' + expected.length + ' 件作品');
    }
  });
}

test('不含项目区的页面可安全加载共享筛选脚本', () => {
  assert.doesNotThrow(() => vm.runInNewContext(script, {
    document: { documentElement: { classList: { add() {} } }, querySelector() { return null; } },
  }, { timeout: 1000 }));
});
