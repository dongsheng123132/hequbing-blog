const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true});
  const errors = [];
  const results = [];
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    page.on('pageerror', e => errors.push(String(e)));
    for (const path of ['/', '/en', '/about', '/en/about']) {
      await page.goto('http://127.0.0.1:3000'+path, {waitUntil:'networkidle',timeout:20000});
      assert.equal(await page.locator('[data-project-id]').count(),18,path);
      assert.equal(await page.locator('[data-project-id]:visible').count(),18,path);
      const overflow = await page.evaluate(() => ({view:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(overflow.scroll <= overflow.view + 1, JSON.stringify({path,width,overflow}));
      await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(i => { i.loading = 'eager'; return i.complete ? Promise.resolve() : new Promise(resolve => { i.addEventListener('load', resolve, {once:true}); i.addEventListener('error', resolve, {once:true}); setTimeout(resolve, 5000); }); })));
      const images = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || !i.naturalWidth).map(i=>i.src));
      assert.deepEqual(images, [], path);
      const origin = page.locator('[data-project-id="benxiang"]');
      assert.ok(await origin.locator('a[href="https://2origin.org"]').count() > 0);
      assert.equal(await origin.locator('a[href="https://github.com/dongsheng123132/2origin"]').count(),1);
      if (path==='/' || path==='/en') {
        for (const type of ['product','protocol','research','experiment','all']) {
          await page.locator('[data-work-filter="'+type+'"]').click();
          const types = await page.locator('[data-project-id]:visible').evaluateAll(cards=>cards.map(c=>c.dataset.workType));
          assert.ok(types.length > 0);
          if(type==='all') assert.equal(types.length,18); else assert.ok(types.every(t=>t===type));
        }
        if (path==='/' && width===1440) {
          await page.locator('#works').scrollIntoViewIfNeeded();
          await page.screenshot({path:'seo-growth/ops/reviews/2026-10-12-projects/desktop.png'});
          await page.locator('.project-catalog').screenshot({path:'seo-growth/ops/reviews/2026-10-12-projects/catalog.png'});
        }
        if (path==='/' && width===390) {
          await origin.scrollIntoViewIfNeeded();
          await page.screenshot({path:'seo-growth/ops/reviews/2026-10-12-projects/mobile.png'});
        }
      }
      results.push({path,width,projects:18,overflow:false});
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await browser.close();
  fs.writeFileSync('seo-growth/ops/reviews/2026-10-12-projects/browser-results.json',JSON.stringify({ok:true,results},null,2));
  console.log(JSON.stringify({ok:true,checked:results.length,errors}));
})().catch(e=>{console.error(e);process.exit(1)});
