import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/zarven-landing-page.html' : path));
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
await mkdir(resolve(root, '.qa'), { recursive: true });
let browser;
const errors = [];
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 740]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 768, isMobile: width <= 768, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      // A pause saved by an older version must not disable a new visit.
      localStorage.setItem('zarven-scroll-motion', 'off');
      window.motionFrames = 0;
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => original.call(window, time => {
        window.motionFrames++;
        callback(time);
      });
    });
    await page.goto(url);
    await page.waitForFunction(() => document.documentElement.dataset.modelRenderer === 'worker');
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('html').getAttribute('data-scroll-motion'), 'on');
    const canvas = page.locator('.model-stage canvas');
    const firstTransform = await canvas.evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(250);
    assert.notEqual(await canvas.evaluate(el => getComputedStyle(el).transform), firstTransform, 'Hero animates before scrolling');
    assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).opacity), '1');
    assert.equal(await page.locator('.hero-enter').count(), 0, 'Hero entrance should release its animation');
    await page.screenshot({ path: resolve(root, `.qa/hero-${width}.png`) });
    if (width === 1440) {
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip-link').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.locator('.product-card').first().hover();
      await page.waitForTimeout(1200);
      assert.notEqual(await page.locator('.product-card').first().evaluate(el => getComputedStyle(el).transform), 'none');
      await page.mouse.move(0, 0);
      const frames = await page.evaluate(async () => {
        const intervals = [];
        let previous = performance.now();
        for (let i = 0; i < 90; i++) {
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          intervals.push(now - previous);
          previous = now;
          scrollTo({ top: i * 30, behavior: 'instant' });
        }
        return intervals.sort((a, b) => a - b);
      });
      console.log(`Scroll sample: p95 ${frames[Math.floor(frames.length * .95)].toFixed(1)}ms/frame (headless Chrome)`);
    }
    for (const section of await page.locator('main section').all()) {
      await section.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForTimeout(1200);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
      const invisible = await section.locator('.reveal').evaluateAll(elements => elements.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < innerHeight - 24 && rect.bottom > 0 && getComputedStyle(el).opacity !== '1';
      }).length);
      assert.equal(invisible, 0, `Visible content still hidden at ${width}px`);
    }
    const summaries = page.locator('.faq-item summary');
    await summaries.nth(0).click();
    await summaries.nth(1).click();
    assert.equal(await page.locator('.faq-item[open]').count(), 1);
    await page.locator('.brand').last().click();
    // Native smooth-scroll duration depends on the document height and browser.
    await page.waitForFunction(() => scrollY < 5, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => location.hash), '#topo');
    assert(await page.evaluate(() => scrollY < 5));
    assert.equal(await page.locator('#header').evaluate(el => el.classList.contains('scrolled')), false);
    const toggle = page.locator('.model-motion-toggle');
    await toggle.click();
    await page.waitForTimeout(100);
    const pausedTransform = await canvas.evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(250);
    assert.equal(await canvas.evaluate(el => getComputedStyle(el).transform), pausedTransform, 'Pause stops idle motion');
    const frozen = await page.locator('.model-stage').getAttribute('data-progress');
    await page.evaluate(() => scrollTo({ top: 180, behavior: 'instant' }));
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.model-stage').getAttribute('data-progress'), frozen);
    assert.equal(await page.locator('html').getAttribute('data-scroll-motion'), 'off');
    assert(await page.locator('#header').evaluate(el => el.classList.contains('scrolled')));
    await toggle.click();
    const resumedTransform = await canvas.evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(250);
    assert.notEqual(await canvas.evaluate(el => getComputedStyle(el).transform), resumedTransform, 'Activate resumes idle motion');
    await page.waitForTimeout(1400);
    const idleFrames = await page.evaluate(() => window.motionFrames);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.motionFrames), idleFrames, 'No idle JS animation loop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.model-motion-toggle').disabled);
    await page.waitForTimeout(100);
    assert(await toggle.isDisabled());
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
    const staticProgress = await page.locator('.model-stage').getAttribute('data-progress');
    await page.evaluate(() => scrollTo({ top: 350, behavior: 'instant' }));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.model-stage').getAttribute('data-progress'), staticProgress);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.querySelector('.model-motion-toggle').disabled);
    assert.equal(await toggle.isDisabled(), false);
    console.log(`OK: ${width}px — reveals, layout, FAQ, anchors, pause, live reduced motion, idle frames`);
    await context.close();
  }
  for (const mode of ['unsupported', 'blocked']) {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    if (mode === 'unsupported') await context.addInitScript(() => {
      window.Worker = undefined;
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => args[0] === 'animation-timeline' ? false : supports(...args);
    });
    else await context.route('**/model-worker.js*', route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => document.documentElement.dataset.modelRenderer === 'main');
    await page.waitForTimeout(300);
    const before = await page.locator('.model-stage').getAttribute('data-progress');
    await page.evaluate(() => scrollTo({ top: 250, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    assert.notEqual(await page.locator('.model-stage').getAttribute('data-progress'), before);
    assert.notEqual(await page.locator('#scroll-progress').evaluate(el => getComputedStyle(el).transform), 'matrix(0, 0, 0, 1, 0, 0)');
    console.log(`OK: ${mode} worker — compatible renderer and progress fallback`);
    await context.close();
  }
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await reduced.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#como-funciona').evaluate(el => el.scrollIntoView());
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.process-model').getAttribute('data-progress'), '1.000');
  assert.equal(await page.locator('.reveal').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1')), true);
  assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0);
  await reduced.close();
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noJS.newPage();
  await fallback.goto(url);
  assert.equal(await fallback.locator('.reveal').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1')), true);
  await noJS.close();
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('OK: reduced motion on load, no-JS content fallback, no runtime errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
