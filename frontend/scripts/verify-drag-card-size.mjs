import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
const WSL_IP = (await import('node:child_process')).execSync('hostname -I').toString().trim().split(/\s+/)[0]
const BASE = `http://${WSL_IP}:3000`
const BOARD_URL = `${BASE}/org/dmy_org/workspaces/1`
const LONG_TITLE = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
const WIN_CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
const DEBUG_PORT = 9333
async function launchChrome () {
  const proc = spawn(WIN_CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank',
  ], { stdio: 'ignore' })
  for (let i = 0; i < 30; i++) {
    try {
      const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
        defaultViewport: { width: 1400, height: 900 },
      })
      return { browser, proc }
    } catch {
      await sleep(200)
    }
  }
  proc.kill()
  throw new Error('failed to connect to Chrome debug port')
}
async function main () {
  const { browser, proc } = await launchChrome()
  const page = await browser.newPage()
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.setItem('id_token', '1'))
    await page.goto(BOARD_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.waitForSelector('.list-column .add-card-btn', { timeout: 15000 })
    await page.click('.list-column .add-card-btn')
    await page.waitForSelector('.composer-input', { visible: true })
    await page.type('.composer-input', LONG_TITLE)
    await page.click('.composer-submit-btn')
    await page.waitForFunction(
      (title) => [...document.querySelectorAll('.task-card .task-title')].some(el => el.textContent?.includes(title.slice(0, 20))),
      { timeout: 10000 },
      LONG_TITLE,
    )
    const card = await page.evaluateHandle((title) => {
      const cards = [...document.querySelectorAll('.task-card')]
      return cards.find(c => c.querySelector('.task-title')?.textContent?.includes(title.slice(0, 20))) ?? null
    }, LONG_TITLE)
    const cardEl = card.asElement()
    if (!cardEl) throw new Error('created card not found')
    const before = await page.evaluate((el) => ({
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      scrollHeight: el.scrollHeight,
      rectHeight: el.getBoundingClientRect().height,
    }), cardEl)
    const box = await cardEl.boundingBox()
    if (!box) throw new Error('card bounding box missing')
    const startX = box.x + box.width / 2
    const startY = box.y + Math.min(box.height / 2, 40)
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY + 80, { steps: 12 })
    await sleep(500)
    const during = await page.evaluate(() => {
      const fallback = document.querySelector('body > .task-card.sortable-fallback')
        ?? document.querySelector('.task-card.sortable-fallback')
      const title = fallback?.querySelector('.task-title')
      const fallbackRect = fallback?.getBoundingClientRect()
      const titleRect = title?.getBoundingClientRect()
      return {
        fallback: fallback
          ? {
              offsetWidth: fallback.offsetWidth,
              offsetHeight: fallback.offsetHeight,
              scrollHeight: fallback.scrollHeight,
              rectHeight: fallback.getBoundingClientRect().height,
              styleWidth: fallback.style.width,
              styleHeight: fallback.style.height,
              className: fallback.className,
            }
          : null,
        titleSpills: fallbackRect && titleRect
          ? titleRect.bottom > fallbackRect.bottom + 1
          : null,
        titleOverflows: title
          ? title.scrollHeight > title.clientHeight + 1
          : null,
      }
    })
    await page.screenshot({ path: '/tmp/drag-card-verify.png' })
    await page.mouse.up()
    console.log(JSON.stringify({ before, during }, null, 2))
    if (!during.fallback) {
      throw new Error('sortable-fallback element not found during drag')
    }
    if (!during.fallback.className.includes('sortable-fallback')) {
      throw new Error(`fallback missing sortable-fallback class: ${during.fallback.className}`)
    }
    const heightDelta = Math.abs(during.fallback.offsetHeight - before.offsetHeight)
    if (heightDelta > 2) {
      throw new Error(`height changed by ${heightDelta}px (before=${before.offsetHeight}, during=${during.fallback.offsetHeight})`)
    }
    if (during.titleSpills || during.titleOverflows) {
      throw new Error('title text overflows fallback card bounds')
    }
    console.log('PASS: drag card keeps original size and text stays inside')
  } finally {
    await browser.disconnect()
    proc.kill()
  }
}
main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
