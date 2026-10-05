/**
 * Capture README screenshots against a running `pnpm dev` server.
 * Usage: pnpm screenshots  (requires `pnpm dev`)
 *
 * Viewport is intentionally wide so Search/Highlight/Filters and
 * Controls/Order/Color/Columns stay on one toolbar row.
 */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.KANJI_MAP_URL ?? 'http://localhost:3000'
const OUT = resolve('docs/screenshots')
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'

/** Wide enough that left + right toolbar groups do not wrap. */
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 as const }

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

async function setSelect(page: puppeteer.Page, label: string, optionText: string) {
  // Resolve the combobox handle via the field label, then use Puppeteer clicks
  // (Reka UI ignores synthetic element.click() from evaluate).
  const comboHandle = await page.evaluateHandle((fieldLabel) => {
    const lab = [...document.querySelectorAll('label')]
      .find(l => (l.textContent || '').trim() === fieldLabel)
    if (!lab) throw new Error(`label not found: ${fieldLabel}`)
    let root: HTMLElement | null = lab.parentElement
    for (let i = 0; i < 6 && root; i++) {
      const combo = root.querySelector<HTMLElement>('[role="combobox"]')
      if (combo) return combo
      root = root.parentElement
    }
    throw new Error(`combo not found: ${fieldLabel}`)
  }, label)

  const combo = comboHandle.asElement()
  if (!combo) throw new Error(`combo handle missing: ${label}`)
  await combo.click()
  await sleep(350)
  await page.waitForSelector('[role="option"]', { timeout: 5000 })

  const optionHandle = await page.evaluateHandle((text) => {
    const opt = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(o => (o.textContent || '').trim() === text)
    if (!opt) {
      const names = [...document.querySelectorAll('[role="option"]')]
        .map(o => (o.textContent || '').trim())
      throw new Error(`option not found: ${text}; have ${names.join(' | ')}`)
    }
    return opt
  }, optionText)

  const option = optionHandle.asElement()
  if (!option) throw new Error(`option handle missing: ${optionText}`)
  await option.click()
  await sleep(750)
  await comboHandle.dispose()
  await optionHandle.dispose()
}

async function assertSelect(page: puppeteer.Page, label: string, expected: string) {
  const actual = await page.evaluate((fieldLabel) => {
    const lab = [...document.querySelectorAll('label')]
      .find(l => (l.textContent || '').trim() === fieldLabel)
    let root: HTMLElement | null = lab?.parentElement ?? null
    for (let i = 0; i < 6 && root; i++) {
      const combo = root.querySelector('[role="combobox"]')
      if (combo) return (combo.textContent || '').trim()
      root = root.parentElement
    }
    return ''
  }, label)
  if (actual !== expected) {
    throw new Error(`${label} expected "${expected}", got "${actual}"`)
  }
}

async function shot(page: puppeteer.Page, name: string) {
  await page.screenshot({ path: resolve(OUT, name), type: 'png' })
  console.log('wrote', name)
}

async function openButton(page: puppeteer.Page, ariaLabel: string) {
  const handle = await page.evaluateHandle((name) => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.getAttribute('aria-label') === name)
    if (!btn) throw new Error(`button not found: ${name}`)
    return btn
  }, ariaLabel)
  const el = handle.asElement()
  if (!el) throw new Error(`button handle missing: ${ariaLabel}`)
  await el.click()
  await handle.dispose()
  await sleep(800)
}

async function pressEscape(page: puppeteer.Page) {
  await page.keyboard.press('Escape')
  await sleep(450)
}

async function clickKanji(page: puppeteer.Page, character: string) {
  await page.evaluate((ch) => {
    const cell = [...document.querySelectorAll<HTMLButtonElement>('button[title]')]
      .find(b => (b.getAttribute('title') || '').startsWith(`${ch} ·`))
    if (!cell) throw new Error(`kanji cell not found: ${ch}`)
    cell.click()
  }, character)
  await sleep(1200)
}

async function openHighlightMenu(page: puppeteer.Page) {
  const handle = await page.evaluateHandle(() => {
    const lab = [...document.querySelectorAll('label')]
      .find(l => (l.textContent || '').trim() === 'Highlight')
    if (!lab) throw new Error('Highlight label missing')
    let root: HTMLElement | null = lab.parentElement
    for (let i = 0; i < 6 && root; i++) {
      const candidates = [...root.querySelectorAll<HTMLElement>('button')]
        .filter(b => b.getAttribute('aria-label') !== 'Help')
      const trigger = candidates.find(b =>
        (b.textContent || '').includes('None')
        || b.getAttribute('aria-haspopup') === 'listbox'
        || b.getAttribute('aria-expanded') != null
      ) || candidates[0]
      if (trigger) return trigger
      root = root.parentElement
    }
    throw new Error('Highlight trigger not found')
  })
  const el = handle.asElement()
  if (!el) throw new Error('Highlight trigger handle missing')
  await el.click()
  await handle.dispose()
  await sleep(600)
}

/** Baseline for non–color-mode shots: Jōyō order + SRS coloring + 40 columns. */
async function resetBaseline(page: puppeteer.Page) {
  await setSelect(page, 'Order', 'Jōyō appearance')
  await setSelect(page, 'Color mode', 'SRS stage')
  await setSelect(page, 'Columns', '40')
  await assertSelect(page, 'Color mode', 'SRS stage')
  await assertSelect(page, 'Order', 'Jōyō appearance')
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`
    ]
  })
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1500)

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  if (isDark) {
    await openButton(page, 'Switch to light mode')
  }

  await resetBaseline(page)
  await shot(page, 'overview-toolbar.png')
  await shot(page, 'order-joyo.png')

  // Order modes — always SRS color
  for (const [option, file] of [
    ['JLPT level', 'order-jlpt.png'],
    ['WaniKani order', 'order-wanikani.png'],
    ['SRS stage', 'order-srs.png'],
    ['Usage (frequency)', 'order-usage.png'],
    ['Accuracy', 'order-accuracy.png'],
    ['Number of readings', 'order-readings.png'],
    ['Stroke count', 'order-strokes.png']
  ] as const) {
    await setSelect(page, 'Order', option)
    await assertSelect(page, 'Color mode', 'SRS stage')
    await shot(page, file)
  }

  // Color-mode gallery — Jōyō order, vary color only
  await setSelect(page, 'Order', 'Jōyō appearance')
  for (const [option, file] of [
    ['--', 'color-none.png'],
    ['School year', 'color-year.png'],
    ['JLPT level', 'color-jlpt.png'],
    ['SRS stage', 'color-srs.png'],
    ['Accuracy (Overall)', 'color-accuracy.png'],
    ['Accuracy (Overall)', 'color-accuracy-joyo.png'],
    ['WaniKani level', 'color-wk.png'],
    ['WaniKani level groups', 'color-wk-group.png'],
    ['Stroke count', 'color-strokes.png'],
    ['Reading count', 'color-readings.png']
  ] as const) {
    await setSelect(page, 'Color mode', option)
    await shot(page, file)
  }

  await setSelect(page, 'Color mode', 'Accuracy (Overall)')
  await setSelect(page, 'Order', 'WaniKani order')
  await shot(page, 'color-accuracy-wanikani.png')

  // Back to SRS for interaction / modal shots
  await resetBaseline(page)

  await openHighlightMenu(page)
  await shot(page, 'highlight-menu.png')
  await pressEscape(page)

  await openButton(page, 'Help')
  await sleep(400)
  await shot(page, 'modal-help.png')
  await pressEscape(page)
  await sleep(300)

  await openButton(page, 'Settings')
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('h2, [data-slot="title"]')]
      .some(el => (el.textContent || '').trim() === 'Settings')
  }, { timeout: 5000 })
  await sleep(400)
  await shot(page, 'modal-settings.png')
  await pressEscape(page)
  await sleep(300)

  await clickKanji(page, '語')
  await sleep(800)
  await shot(page, 'modal-kanji-detail.png')
  await pressEscape(page)
  await sleep(300)

  await openButton(page, 'Switch to dark mode')
  await sleep(500)
  await assertSelect(page, 'Color mode', 'SRS stage')
  await shot(page, 'overview-dark.png')
  await openButton(page, 'Switch to light mode')

  await browser.close()
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
