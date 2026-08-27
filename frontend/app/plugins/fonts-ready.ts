import noto400 from '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2?url'
import noto600 from '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-600-normal.woff2?url'
import noto700 from '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff2?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'

/**
 * 初回描画前にクリティカルなウェイトを preload / load し、
 * フォールバック太さのフラッシュを防ぐ。
 */
export default defineNuxtPlugin(() => {
  useHead({
    link: [
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: noto400 },
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: noto600 },
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: noto700 },
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: inter600 },
      { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: inter700 },
    ],
  })

  if (!import.meta.client) {
    return
  }

  const root = document.documentElement
  if (root.classList.contains('fonts-ready')) {
    return
  }

  const reveal = () => {
    root.classList.add('fonts-ready')
  }

  const timeoutId = window.setTimeout(reveal, 2500)

  const loadCriticalFaces = async () => {
    if (!document.fonts?.load) {
      return
    }
    // @font-face 登録待ち（Vite dev では CSS 注入が遅れることがある）
    const started = performance.now()
    while (performance.now() - started < 2000) {
      const registered = [...document.fonts].some((face) => {
        const family = face.family.replace(/["']/g, '')
        return family === 'Noto Sans JP' || family === 'Inter'
      })
      if (registered) {
        break
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }
    await Promise.all([
      document.fonts.load('400 14px "Noto Sans JP"'),
      document.fonts.load('600 16px "Noto Sans JP"'),
      document.fonts.load('700 14px "Noto Sans JP"'),
      document.fonts.load('600 16px Inter'),
      document.fonts.load('700 14px Inter'),
    ])
  }

  void loadCriticalFaces()
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(timeoutId)
      reveal()
    })
})
