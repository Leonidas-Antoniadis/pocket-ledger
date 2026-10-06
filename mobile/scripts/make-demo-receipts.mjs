/**
 * Renders a few fake-but-realistic receipts to JPEG files in assets/demo/.
 * They are used by the dev-only "Load demo data" action and by the screenshot script.
 *
 * Usage:  node scripts/make-demo-receipts.mjs
 * Needs Chrome/Edge installed (uses puppeteer-core, no browser download).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { findChrome } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'demo');
mkdirSync(outDir, { recursive: true });

const receipts = [
  {
    file: 'receipt-fuel.jpg',
    shop: 'SHELL',
    sub: 'Λ. Κηφισίας 128, Μαρούσι · ΑΦΜ 094012345',
    lines: [
      ['UNLEADED 95', '38.42 L × 1.769', '67.97'],
      ['ΦΠΑ 24%', '', '13.15'],
    ],
    total: '67.97',
    pay: 'ΚΑΡΤΑ VISA **** 4421',
    date: '02/10/2026 08:14',
    no: 'ΑΠΥ 0004471',
    tint: '#fffdf7',
  },
  {
    file: 'receipt-phone.jpg',
    shop: 'VODAFONE',
    sub: 'Λογαριασμός κινητής · 69xxxxxxxx',
    lines: [
      ['Giga Unlimited 30GB', '01/09–30/09', '24.19'],
      ['Τέλος συνδρομητών', '', '2.90'],
      ['ΦΠΑ 24%', '', '6.50'],
    ],
    total: '33.59',
    pay: 'ΠΑΓΙΑ ΕΝΤΟΛΗ',
    date: '05/10/2026',
    no: 'INV 2026-09-118823',
    tint: '#fbfbff',
  },
  {
    file: 'receipt-repair.jpg',
    shop: 'MOTO SERVICE ΝΙΚΟΣ',
    sub: 'Αχαρνών 212, Αθήνα · ΑΦΜ 123456789',
    lines: [
      ['Λάδι 10W-40 1.2L', '', '18.00'],
      ['Φίλτρο λαδιού', '', '9.50'],
      ['Εργασία service', '', '25.00'],
      ['ΦΠΑ 24%', '', '12.60'],
    ],
    total: '65.10',
    pay: 'ΜΕΤΡΗΤΑ',
    date: '28/09/2026 17:40',
    no: 'ΤΠΥ 000912',
    tint: '#fffcf5',
  },
  {
    file: 'receipt-parking.jpg',
    shop: 'ΔΗΜΟΤΙΚΟ ΠΑΡΚΙΝΓΚ',
    sub: 'Πλ. Κλαυθμώνος · Αθήνα',
    lines: [
      ['Στάθμευση 2h 15m', '', '4.50'],
      ['ΦΠΑ 24%', '', '0.87'],
    ],
    total: '4.50',
    pay: 'ΚΑΡΤΑ',
    date: '30/09/2026 13:05',
    no: 'TICKET 88213',
    tint: '#fdfdfd',
  },
  {
    file: 'receipt-bag.jpg',
    shop: 'COURIER GEAR STORE',
    sub: 'online order #CG-55012',
    lines: [
      ['Insulated delivery bag 45L', '', '39.90'],
      ['Phone holder (handlebar)', '', '14.90'],
      ['Shipping', '', '3.50'],
    ],
    total: '58.30',
    pay: 'CARD **** 4421',
    date: '19/09/2026',
    no: 'INVOICE 55012',
    tint: '#ffffff',
  },
  {
    file: 'receipt-insurance.jpg',
    shop: 'ΑΣΦΑΛΙΣΤΙΚΗ ΑΕ',
    sub: 'Ασφάλιση δικύκλου · Συμβ. 77-4410-2',
    lines: [
      ['Αστική ευθύνη 6μηνο', '01/10–31/03', '96.00'],
      ['Οδική βοήθεια', '', '18.00'],
    ],
    total: '114.00',
    pay: 'ΤΡΑΠΕΖΙΚΗ ΜΕΤΑΦΟΡΑ',
    date: '01/10/2026',
    no: 'ΑΠΟΔΕΙΞΗ 2026/4410',
    tint: '#fcfdff',
  },
];

function html(r) {
  const rows = r.lines
    .map(
      ([a, b, c]) =>
        `<tr><td>${a}</td><td class="m">${b}</td><td class="n">${c}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#8a8f99;}
    .paper{width:560px;margin:40px auto;padding:40px 44px 56px;background:${r.tint};color:#1b1b1b;
      font-family:"Courier New",Courier,monospace;font-size:19px;line-height:1.35;
      box-shadow:0 18px 40px rgba(0,0,0,.35);transform:rotate(-1.2deg);}
    h1{font-size:30px;letter-spacing:3px;text-align:center;margin:0 0 6px;font-weight:700}
    .sub{text-align:center;font-size:15px;color:#444;margin-bottom:18px}
    hr{border:0;border-top:2px dashed #999;margin:14px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:4px 0;vertical-align:top}
    td.m{color:#555;font-size:15px;padding-left:8px}
    td.n{text-align:right;white-space:nowrap}
    .total td{font-weight:700;font-size:24px;padding-top:10px}
    .meta{font-size:15px;color:#333;margin-top:16px}
    .bar{margin:22px auto 0;height:54px;width:360px;background:repeating-linear-gradient(90deg,#111 0 3px,transparent 3px 6px,#111 6px 7px,transparent 7px 11px,#111 11px 13px,transparent 13px 15px)}
    .thanks{text-align:center;margin-top:12px;font-size:15px;letter-spacing:2px}
  </style></head><body><div class="paper">
    <h1>${r.shop}</h1><div class="sub">${r.sub}</div><hr/>
    <table>${rows}<tr class="total"><td>ΣΥΝΟΛΟ / TOTAL</td><td></td><td class="n">€ ${r.total}</td></tr></table>
    <hr/><div class="meta">${r.date}<br/>${r.no}<br/>${r.pay}</div>
    <div class="bar"></div><div class="thanks">ΕΥΧΑΡΙΣΤΟΥΜΕ · THANK YOU</div>
  </div></body></html>`;
}

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 1.5 });
  for (const r of receipts) {
    await page.setContent(html(r), { waitUntil: 'load' });
    const paper = await page.$('.paper');
    const box = await paper.boundingBox();
    const path = join(outDir, r.file);
    await page.screenshot({
      path,
      type: 'jpeg',
      quality: 80,
      clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 },
    });
    console.log('wrote', path);
  }
} finally {
  await browser.close();
}
