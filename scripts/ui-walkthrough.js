// Clicks through the whole product in a real (headless) browser: open -> chat -> preview -> edit -> render -> download.
// Usage: node scripts/ui-walkthrough.js [baseUrl] [outDir]   (server must be running: npm start)
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = process.argv[3] || 'scripts/tmp/shots';
const IMG = process.argv[4] || 'scripts/tmp/demo'; // folder with logo.png, cake.jpg, cupcakes.jpg
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page error]', e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
async function clickText(text, sel = 'button, a') {
  await page.waitForFunction((t, s) => [...document.querySelectorAll(s)].some((e) => e.textContent.trim().includes(t) && !e.disabled), { timeout: 120000 }, text, sel);
  await page.evaluate((t, s) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t) && !e.disabled).click(), text, sel);
}
async function chat(msg) {
  const before = await page.$$eval('.bubble-ai', (e) => e.length);
  await page.type('textarea[aria-label="Message"]', msg);
  await page.keyboard.press('Enter');
  await page.waitForFunction((n) => document.querySelectorAll('.bubble-ai:not(.typing)').length > n, { timeout: 120000 }, before);
}

await page.setViewport({ width: 1280, height: 860 });
await page.goto(BASE, { waitUntil: 'networkidle2' });           // no sign-in: opens straight to "pick a style"
await page.waitForSelector('[role="dialog"]');
await sleep(1200);
await shot('01-open');
await clickText('Naija Bold', '[role="dialog"] button');

await page.waitForSelector('textarea[aria-label="Message"]');
await chat('Kemi Cakes, we bake birthday and wedding cakes');
await chat('Birthday cakes from ₦15,000, Cupcakes (box of 6) ₦4,500, Free delivery in Ado Ekiti');
await chat('08061234567, 3 Fajuyi Road, Ado Ekiti');
// "Add logo" and "Add photos" buttons in the sidebar
const logoInput = await page.$('aside input[type=file]:not([multiple])');
await logoInput.uploadFile(`${IMG}/logo.png`);
await page.waitForFunction(() => document.querySelectorAll('aside li img').length >= 1, { timeout: 30000 });
const photoInput = await page.$('aside input[type=file][multiple]');
await photoInput.uploadFile(`${IMG}/cake.jpg`, `${IMG}/cupcakes.jpg`);
await page.waitForFunction(() => document.querySelectorAll('aside li img').length >= 3, { timeout: 30000 });
await sleep(800);
await shot('01b-images');
await chat('done');
await shot('01c-voice-question');
await chat('1');
await chat('Is it your birthday this weekend? At Kemi Cakes, every cake is baked fresh with love. Our birthday cakes start from just ₦15,000. Want something small? Grab a box of six cupcakes for ₦4,500. Call or WhatsApp 0806 123 4567 to order today!');
await chat('pink and gold, for whatsapp status');
await chat('yes, generate it');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Generate Code')), { timeout: 120000 });
await shot('02-plan');

await clickText('Generate Code');
await page.waitForFunction(() => document.querySelector('iframe[title="Video preview"]'), { timeout: 300000 });
await sleep(4000);
await shot('03-preview');
// The Voiceover tab opens by itself when the plan has a script
await page.waitForFunction(() => document.body.textContent.includes('Your script'), { timeout: 30000 });
await shot('04-voice-tab');
await clickText('Make the', 'button');                            // AI voice (falls back to the basic voice offline)
await page.waitForFunction(() => document.body.textContent.includes('Voiceover added'), { timeout: 300000 });
await sleep(1500);
await shot('04b-voice-added');
const fitBox = await page.$('input[type=checkbox]');
if (fitBox) { await fitBox.click(); await sleep(1500); }

await clickText('Generate Video');
await page.waitForFunction(() => document.body.textContent.includes('Make your MP4'));
await shot('05-render-start');
await clickText('Generate Video', 'main button');                // test mode: no ad
await page.waitForFunction(() => document.querySelector('[role="progressbar"]'), { timeout: 30000 });
await sleep(8000);
await shot('06-rendering');
await page.waitForFunction(() => document.body.textContent.includes('Your video is ready'), { timeout: 900000 });
await sleep(1500);
await shot('07-done');

// Download the MP4 exactly as a user would get it
const href = await page.$eval('a[href^="/download/"]', (a) => a.href);
const res = await fetch(href);
const buf = Buffer.from(await res.arrayBuffer());
await writeFile(`${OUT}/video.mp4`, buf);
console.log(`downloaded ${res.headers.get('content-disposition')} (${(buf.length / 1e6).toFixed(1)} MB)`);

await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' }); await sleep(1000);
await shot('08-my-videos');
await browser.close();
console.log('walkthrough complete');
