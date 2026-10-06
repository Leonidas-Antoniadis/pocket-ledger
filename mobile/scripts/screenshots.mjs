/**
 * Takes the README screenshots from the web build of the app, emulating a phone.
 *
 *   1. start the web dev server:   npx expo start --web --port 8081
 *   2. run:                        node scripts/screenshots.mjs   (APP_URL overrides http://localhost:8081)
 *
 * Output: ../docs/screenshots/*.png. Needs Chrome/Edge installed (puppeteer-core, no browser download).
 * The script uses a throw-away browser profile, loads the dev-only demo data, then walks through the app by
 * clicking (full page reloads are avoided: the web SQLite worker only serves one page at a time).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { findChrome } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

const BASE = (process.env.APP_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const FIRST_LOAD_TIMEOUT = 300_000; // Metro bundles on first request

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const currentMonthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(today);

const log = (...args) => console.log('[screenshots]', ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--lang=en-GB', '--hide-scrollbars'],
});

/** Helpers injected into every page: inactive tab screens stay in the DOM, so only visible nodes count. */
const PAGE_HELPERS = () => {
  const isVisible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
    return el.getClientRects().length > 0;
  };
  const visibleText = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      if (text && isVisible(node.parentElement)) parts.push(text);
    }
    return parts.join('\n');
  };
  const findText = (text, pickLast) => {
    const nodes = Array.from(document.querySelectorAll('div, span, button, a')).filter(
      (el) => el.childElementCount === 0 && el.textContent.trim() === text && isVisible(el),
    );
    return (pickLast ? nodes[nodes.length - 1] : nodes[0]) ?? null;
  };
  window.__pl = { isVisible, visibleText, findText };
};

async function newPhonePage(colorScheme = 'light') {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(PAGE_HELPERS);
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: colorScheme }]);
  page.on('pageerror', (error) => log('page error:', error.message));
  return page;
}

async function describe(page) {
  return page.evaluate(() => `${location.pathname}\n${window.__pl.visibleText().slice(0, 500)}`);
}

async function waitForText(page, text, timeout = 45_000) {
  try {
    await page.waitForFunction((t) => window.__pl && window.__pl.visibleText().includes(t), { timeout }, text);
  } catch (error) {
    throw new Error(`Timed out waiting for "${text}". Page shows:\n${await describe(page)}\n${error.message}`);
  }
}

async function waitForPath(page, prefix, timeout = 20_000) {
  try {
    await page.waitForFunction((p) => location.pathname.startsWith(p), { timeout }, prefix);
  } catch (error) {
    throw new Error(`Timed out waiting for URL ${prefix}. Page shows:\n${await describe(page)}\n${error.message}`);
  }
}

/** Full page load with one retry; used only when a reload is unavoidable. */
async function open(page, path, text, timeout = 45_000) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout });
    try {
      await waitForText(page, text, timeout);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      log(`retrying ${path}…`);
    }
  }
}

async function clickText(page, text, { last = false } = {}) {
  const handle = await page.evaluateHandle((t, pickLast) => window.__pl.findText(t, pickLast), text, last);
  const element = handle.asElement();
  if (!element) throw new Error(`Visible text not found on page: ${text}\n${await describe(page)}`);
  await element.click();
}

/** Bottom tab bar: prefer the link by href, fall back to the last visible text match. */
async function clickTab(page, label, href) {
  const link = await page.$(`a[href="${href}"]`);
  if (link) {
    await link.click();
  } else {
    await clickText(page, label, { last: true });
  }
}

async function clickFirstVisibleImage(page) {
  const handle = await page.evaluateHandle(
    () => Array.from(document.querySelectorAll('img')).find((img) => window.__pl.isVisible(img)) ?? null,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`No visible image on page\n${await describe(page)}`);
  await element.click();
}

async function shot(page, name, settleMs = 700) {
  await sleep(settleMs);
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, type: 'png' });
  log('saved', name);
}

try {
  const page = await newPhonePage('light');

  log('opening app (Metro may need a while on first load)…');
  await open(page, '/settings', 'Settings', FIRST_LOAD_TIMEOUT);

  // Demo data + EUR so the screenshots match the real use case.
  await clickText(page, 'Load demo data');
  await waitForText(page, 'Demo data loaded');
  await clickText(page, 'Currency');
  await sleep(600);
  await clickText(page, 'EUR', { last: true });
  await sleep(600);

  await clickTab(page, 'Home', '/');
  await waitForText(page, 'Snap receipt');
  await shot(page, 'home');

  await clickTab(page, 'Receipts', '/receipts');
  await waitForText(page, 'Receipt folders');
  await shot(page, 'receipt-folders');

  await clickText(page, currentMonthLabel);
  await waitForPath(page, `/folder/${currentMonth}`);
  await waitForText(page, `receipts/${currentMonth}`);
  await shot(page, 'receipt-folder-month', 1200);

  await clickFirstVisibleImage(page);
  await waitForPath(page, '/attachment/');
  await waitForText(page, 'Entry');
  await shot(page, 'receipt-photo', 1000);
  await page.goBack();
  await waitForPath(page, `/folder/${currentMonth}`);
  await page.goBack(); // back to the Receipts tab root so the tab bar is clickable again
  await waitForPath(page, '/receipts');
  await waitForText(page, 'Receipt folders');

  await clickTab(page, 'Reports', '/reports');
  await waitForText(page, 'By category');
  await shot(page, 'reports');
  await page.mouse.move(195, 600);
  await page.mouse.wheel({ deltaY: 1500 });
  await shot(page, 'reports-categories', 1000);

  await clickTab(page, 'Home', '/');
  await waitForText(page, 'Snap receipt');
  await clickText(page, 'Shell');
  await waitForPath(page, '/transaction/');
  await waitForText(page, 'Receipt photos');
  await shot(page, 'entry-detail', 1200);
  await page.goBack();
  await waitForText(page, 'Snap receipt');

  await clickText(page, 'Expense');
  await waitForPath(page, '/transaction/new');
  await waitForText(page, 'New expense');
  await clickText(page, 'Fuel');
  await shot(page, 'new-expense', 1200);
  await clickText(page, 'Cancel');
  await waitForText(page, 'Snap receipt');

  await clickTab(page, 'Settings', '/settings');
  await waitForText(page, 'Export & backup');
  await clickText(page, 'Export & backup');
  await waitForPath(page, '/export');
  await waitForText(page, 'Export CSV');
  await shot(page, 'export-backup');
  await page.goBack();
  await waitForText(page, 'Export & backup');

  await clickText(page, 'Categories');
  await waitForPath(page, '/categories');
  await waitForText(page, 'Income categories');
  await shot(page, 'categories');
  await page.goBack();
  await waitForText(page, 'Export & backup');
  await shot(page, 'settings');

  // Greek UI
  await clickText(page, 'Ελληνικά');
  await waitForText(page, 'Ρυθμίσεις');
  await clickTab(page, 'Αρχική', '/');
  await waitForText(page, 'Φωτογράφισε απόδειξη');
  await shot(page, 'home-greek');
  await clickTab(page, 'Ρυθμίσεις', '/settings');
  await waitForText(page, 'Ελληνικά');
  await clickText(page, 'English');
  await waitForText(page, 'Settings');
  await sleep(2500); // let the language setting reach the database before the page goes away
  await page.close();

  // Dark mode (fresh page so the colour scheme applies from the start)
  const dark = await newPhonePage('dark');
  await open(dark, '/', 'Snap receipt');
  await shot(dark, 'home-dark');
  await dark.close();

  log('done →', outDir);
} finally {
  await browser.close();
}
