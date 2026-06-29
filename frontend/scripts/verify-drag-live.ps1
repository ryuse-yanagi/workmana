$ErrorActionPreference = 'Stop'
$WslIp = (wsl hostname -I).Trim().Split(' ')[0]
$BoardUrl = "http://${WslIp}:3000/org/dmy_org/workspaces/1"
$BaseUrl = "http://${WslIp}:3000/"
$LongTitle = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$Port = 9388
$chromeProc = Start-Process -FilePath $Chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  'about:blank'
) -PassThru -WindowStyle Hidden
function Wait-Cdp {
  for ($i = 0; $i -lt 40; $i++) {
    try {
      return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version"
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  throw 'CDP unavailable'
}
function Invoke-CdpEval($ws, [string]$Expression) {
  $id = Get-Random -Maximum 1000000000
  $payload = @{ id = $id; method = 'Runtime.evaluate'; params = @{ expression = $Expression; awaitPromise = $true; returnByValue = $true } } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  $buffer = New-Object byte[] 65536
  for (;;) {
    $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).Result
    $text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
    $msg = $text | ConvertFrom-Json
    if ($msg.id -eq $id) {
      if ($msg.result.exceptionDetails) {
        throw $msg.result.exceptionDetails.text
      }
      return $msg.result.result.value
    }
  }
}
try {
  $null = Wait-Cdp
  $newPage = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/new?$BaseUrl" -Method Put
  $wsUrl = $newPage.webSocketDebuggerUrl
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).Wait()
  function Invoke-CdpMethod($ws, [string]$Method, $Params) {
    $id = Get-Random -Maximum 1000000000
    $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $segment = [ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    $buffer = New-Object byte[] 65536
    for (;;) {
      $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).Result
      $text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
      $msg = $text | ConvertFrom-Json
      if ($msg.id -eq $id) {
        if ($msg.error) { throw $msg.error.message }
        return $msg.result
      }
    }
  }
  $null = Invoke-CdpMethod $ws 'Page.navigate' @{ url = $BaseUrl }
  Start-Sleep -Seconds 2
  $null = Invoke-CdpEval $ws "localStorage.setItem('id_token', '1')"
  $null = Invoke-CdpMethod $ws 'Page.navigate' @{ url = $BoardUrl }
  Start-Sleep -Seconds 2
  $ready = Invoke-CdpEval $ws @"
(async () => {
  for (let i = 0; i < 80; i++) {
    const addBtn = document.querySelector('.list-column .add-card-btn')
    if (addBtn) return 'ready'
    const path = location.pathname
    const hasBoard = !!document.querySelector('.board-page')
    const hasFatal = !!document.querySelector('.load-fatal-panel')
    if (hasFatal) return 'fatal:' + (document.querySelector('.load-fatal-message')?.textContent || '')
    if (path.includes('/login')) return 'redirected-login'
    if (i === 79) return 'not-ready path=' + path + ' board=' + hasBoard + ' html=' + document.documentElement.innerHTML.length
    await new Promise(r => setTimeout(r, 250))
  }
  return 'timeout'
})()
"@
  if ($ready -ne 'ready') { throw "board not ready: $ready" }
  $created = Invoke-CdpEval $ws @"
(async () => {
  const list = document.querySelector('.list-column')
  if (!list) return 'no-list'
  list.querySelector('.add-card-btn')?.click()
  await new Promise(r => setTimeout(r, 300))
  const input = document.querySelector('.composer-input')
  if (!input) return 'no-input'
  input.value = '$LongTitle'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  document.querySelector('.composer-submit-btn')?.click()
  await new Promise(r => setTimeout(r, 1000))
  return 'created'
})()
"@
  if ($created -ne 'created') { throw "card create failed: $created" }
  $before = Invoke-CdpEval $ws @"
(() => {
  const card = [...document.querySelectorAll('.task-card')].find(c => c.querySelector('.task-title')?.textContent?.includes('$($LongTitle.Substring(0,20))'))
  if (!card) return null
  const title = card.querySelector('.task-title')
  const cardRect = card.getBoundingClientRect()
  const titleRect = title?.getBoundingClientRect()
  return {
    offsetHeight: card.offsetHeight,
    offsetWidth: card.offsetWidth,
    titleFontSize: title ? getComputedStyle(title).fontSize : null,
    titleFontFamily: title ? getComputedStyle(title).fontFamily : null,
    titleLineCount: title ? title.getClientRects().length : null,
    titleScrollHeight: title?.scrollHeight,
    spills: titleRect ? titleRect.bottom > cardRect.bottom + 1 : null,
    opacity: title ? getComputedStyle(title).opacity : null,
    visibility: title ? getComputedStyle(title).visibility : null,
  }
})()
"@
  if (-not $before) { throw 'card not found before drag' }
  $drag = Invoke-CdpEval $ws @"
(async () => {
  const card = [...document.querySelectorAll('.task-card')].find(c => c.querySelector('.task-title')?.textContent?.includes('$($LongTitle.Substring(0,20))'))
  if (!card) return { error: 'no-card' }
  const rect = card.getBoundingClientRect()
  const startX = rect.left + rect.width / 2
  const startY = rect.top + 20
  const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' })
  card.dispatchEvent(down)
  document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: startX, clientY: startY + 2, buttons: 1, pointerId: 1, pointerType: 'mouse' }))
  await new Promise(r => setTimeout(r, 50))
  for (let i = 1; i <= 16; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: startX, clientY: startY + i * 5, buttons: 1, pointerId: 1, pointerType: 'mouse' }))
    await new Promise(r => setTimeout(r, 25))
  }
  await new Promise(r => setTimeout(r, 600))
  const fallback = document.querySelector('body > .task-card.sortable-fallback') ?? document.querySelector('.task-card.sortable-fallback')
  const title = fallback?.querySelector('.task-title')
  const cardRect = fallback?.getBoundingClientRect()
  const titleRect = title?.getBoundingClientRect()
  return {
    sourceWidth: card.offsetWidth,
    fallback: fallback ? {
      className: fallback.className,
      offsetWidth: fallback.offsetWidth,
      offsetHeight: fallback.offsetHeight,
      styleWidth: fallback.style.width,
      styleHeight: fallback.style.height,
      styleMinHeight: fallback.style.minHeight,
      titleFontSize: title ? getComputedStyle(title).fontSize : null,
      titleFontFamily: title ? getComputedStyle(title).fontFamily : null,
      titleLineCount: title ? title.getClientRects().length : null,
      titleScrollHeight: title?.scrollHeight,
      titleClientHeight: title?.clientHeight,
      opacity: fallback ? getComputedStyle(fallback).opacity : null,
      visibility: fallback ? getComputedStyle(fallback).visibility : null,
      titleOpacity: title ? getComputedStyle(title).opacity : null,
      titleVisibility: title ? getComputedStyle(title).visibility : null,
      hasDragGhost: fallback?.classList.contains('drag-ghost') ?? null,
    } : null,
    heightDelta: fallback ? Math.abs(fallback.offsetHeight - $($before.offsetHeight)) : null,
    spills: cardRect && titleRect ? titleRect.bottom > cardRect.bottom + 1 : null,
  }
})()
"@
  Write-Output ($drag | ConvertTo-Json -Depth 6)
  Write-Output ("before=" + ($before | ConvertTo-Json -Compress))
  if (-not $drag.fallback) { throw 'sortable-fallback not found during live drag' }
  if ($drag.fallback.className -notlike '*sortable-fallback*') { throw "missing sortable-fallback class: $($drag.fallback.className)" }
  if ($drag.heightDelta -gt 2) { throw "height delta $($drag.heightDelta)px" }
  if ($drag.fallback.titleFontSize -ne $before.titleFontSize) { throw "font-size changed: $($before.titleFontSize) -> $($drag.fallback.titleFontSize)" }
  if ($drag.fallback.titleLineCount -ne $before.titleLineCount) { throw "line count changed: $($before.titleLineCount) -> $($drag.fallback.titleLineCount)" }
  if ([double]$drag.fallback.opacity -lt 0.99) { throw "fallback opacity too low: $($drag.fallback.opacity)" }
  if ($drag.fallback.titleVisibility -eq 'hidden') { throw 'fallback title visibility hidden' }
  if ($drag.fallback.hasDragGhost) { throw 'fallback still has drag-ghost class' }
  if ($drag.spills -and -not $before.spills) { throw 'text spills below card during live drag' }
  Write-Output 'PASS: live board drag keeps card size'
} finally {
  if ($ws) { $ws.Dispose() }
  if ($chromeProc -and -not $chromeProc.HasExited) { $chromeProc | Stop-Process -Force }
}
