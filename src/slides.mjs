// Post e carrossel: abre o HTML que a API montou (template da skill `carrossel`) e fotografa
// cada `.slide` em JPG 1080x1350. O Instagram só aceita JPG em posts de imagem.

import { join } from 'node:path';

import { chromium } from 'playwright';

const WIDTH = 1080;
const HEIGHT = 1350;
const READY_TIMEOUT_MS = 30_000;

let browser = null;

async function openBrowser() {
  if (browser?.isConnected()) return browser;
  try {
    browser = await chromium.launch();
  } catch {
    // Sem o Chromium do Playwright, tenta o Chrome instalado.
    browser = await chromium.launch({ channel: 'chrome' });
  }
  return browser;
}

export async function closeBrowser() {
  await browser?.close().catch(() => undefined);
  browser = null;
}

/** Devolve os arquivos gerados, em ordem. */
export async function renderSlides(job, dir) {
  const page = await (await openBrowser()).newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(job.html, { waitUntil: 'networkidle', timeout: 60_000 });
    // O HTML marca `body[data-ready]` quando as fontes carregaram e o texto foi ajustado.
    await page.waitForSelector('body[data-ready]', { timeout: READY_TIMEOUT_MS });

    const slides = await page.locator('.slide').all();
    if (slides.length === 0) throw new Error('O HTML não tem nenhum .slide');

    const files = [];
    for (const [index, slide] of slides.entries()) {
      const name = `slide-${String(index + 1).padStart(2, '0')}.jpg`;
      const path = join(dir, name);
      await slide.screenshot({ path, type: 'jpeg', quality: 92 });
      files.push({ name, path, contentType: 'image/jpeg', width: WIDTH, height: HEIGHT, role: 'slide' });
    }
    return files;
  } finally {
    await page.close();
  }
}
