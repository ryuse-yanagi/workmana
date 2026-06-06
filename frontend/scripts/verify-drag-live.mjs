import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import WebSocket from 'ws'

const WSL_IP = (await import('node:child_process')).execSync('hostname -I').toString().trim().split(/\s+/)[0]
const BOARD_URL = `http://${WSL_IP}:3000/org/test-co/projects/1`
const LONG_TITLE = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
const WIN_CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
const DEBUG_PORT = 9355

async function cdpEval (ws, expression) {
  const id = Math.floor(Math.random() * 1e9)
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  for (;;) {
    const raw = await new Promise((resolve) => ws.once('message', resolve))
    const msg = JSON.parse(raw.toString())
    if (msg.id === id) {
      if (msg.result?.exceptionDetails) {
        throw new Error(msg.result.exceptionDetails.text || 'CDP eval failed')
      }
      return msg.result?.result?.value
    }
  }
}

async function main () {
  const chrome = spawn(WIN_CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank',
  ], { stdio: 'ignore' })

  try {
    let wsUrl = null
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
        const pages = await res.json()
        wsUrl = pages[0]?.webSocketDebuggerUrl
        if (wsUrl) break
      } catch { /* retry */ }
      await sleep(200)
    }
    if (!wsUrl) throw new Error('CDP websocket unavailable')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    await cdpEval(ws, `location.href = ${JSON.stringify(`http://${WSL_IP}:3000/`)}`)
    await sleep(500)
    await cdpEval(ws, `localStorage.setItem('id_token', '1')`)
    await cdpEval(ws, `location.href = ${JSON.stringify(BOARD_URL)}`)
    await sleep(3000)

    const created = await cdpEval(ws, `(async () => {
      const list = document.querySelector('.list-column')
      if (!list) return 'no-list'
      list.querySelector('.add-card-btn')?.click()
      await new Promise(r => setTimeout(r, 300))
      const input = document.querySelector('.composer-input')
      if (!input) return 'no-input'
      input.value = ${JSON.stringify(LONG_TITLE)}
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.composer-submit-btn')?.click()
      await new Promise(r => setTimeout(r, 800))
      return 'created'
    })()`)
    if (created !== 'created') throw new Error(`card create failed: ${created}`)

    const before = await cdpEval(ws, `(() => {
      const card = [...document.querySelectorAll('.task-card')].find(c => c.querySelector('.task-title')?.textContent?.includes(${JSON.stringify(LONG_TITLE.slice(0, 20))}))
      if (!card) return null
      return { offsetHeight: card.offsetHeight, offsetWidth: card.offsetWidth }
    })()`)
    if (!before) throw new Error('card not found before drag')

    const dragResult = await cdpEval(ws, `(async () => {
      const card = [...document.querySelectorAll('.task-card')].find(c => c.querySelector('.task-title')?.textContent?.includes(${JSON.stringify(LONG_TITLE.slice(0, 20))}))
      if (!card) return { error: 'no-card' }
      const rect = card.getBoundingClientRect()
      const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + 20, button: 0, buttons: 1 })
      card.dispatchEvent(down)
      await new Promise(r => setTimeout(r, 50))
      for (let i = 1; i <= 12; i++) {
        const move = new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + 20 + i * 6, button: 0, buttons: 1 })
        document.dispatchEvent(move)
        await new Promise(r => setTimeout(r, 20))
      }
      await new Promise(r => setTimeout(r, 400))
      const fallback = document.querySelector('body > .task-card.sortable-fallback') ?? document.querySelector('.task-card.sortable-fallback')
      const title = fallback?.querySelector('.task-title')
      const cardRect = fallback?.getBoundingClientRect()
      const titleRect = title?.getBoundingClientRect()
      return {
        fallback: fallback ? {
          className: fallback.className,
          offsetHeight: fallback.offsetHeight,
          styleHeight: fallback.style.height,
          styleMinHeight: fallback.style.minHeight,
        } : null,
        heightDelta: fallback ? Math.abs(fallback.offsetHeight - ${before.offsetHeight}) : null,
        spills: cardRect && titleRect ? titleRect.bottom > cardRect.bottom + 1 : null,
      }
    })()`)

    console.log(JSON.stringify({ before, dragResult }, null, 2))

    if (!dragResult?.fallback) throw new Error('sortable-fallback not found during live drag')
    if (!dragResult.fallback.className.includes('sortable-fallback')) {
      throw new Error(`missing sortable-fallback class: ${dragResult.fallback.className}`)
    }
    if (dragResult.heightDelta > 2) throw new Error(`height delta ${dragResult.heightDelta}px`)
    if (dragResult.spills) throw new Error('text spills below card during live drag')

    console.log('PASS: live board drag keeps card size')
    ws.close()
  } finally {
    chrome.kill()
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
