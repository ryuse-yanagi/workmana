/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const sharedDir = resolve(rootDir, '../shared')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  alias: {
    '#shared': sharedDir,
  },
  css: [
    '~/assets/styles/fonts.css',
    '~/assets/styles/_buttons.scss',
    '~/assets/styles/_board-filter.scss',
  ],
  app: {
    head: {
      title: 'WorkMana',
      meta: [
        { name: 'application-name', content: 'WorkMana' },
        { property: 'og:site_name', content: 'WorkMana' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      // 初回ペイント前に隠し、fonts-ready 後に設定どおりの太さで表示する
      style: [
        {
          key: 'fonts-ready-gate',
          textContent: 'html:not(.fonts-ready),html:not(.session-ready){visibility:hidden}html.fonts-ready.session-ready{visibility:visible}',
        },
      ],
      noscript: [
        {
          key: 'fonts-ready-noscript',
          innerHTML: '<style>html{visibility:visible!important}</style>',
        },
      ],
      script: [
        {
          key: 'fonts-ready-timeout',
          // プラグインより先に動かし、失敗時も固まらないよう上限を置く
          textContent: '(function(){var d=document.documentElement;if(d.classList.contains("fonts-ready")&&d.classList.contains("session-ready"))return;setTimeout(function(){d.classList.add("fonts-ready");d.classList.add("session-ready")},2500)})();',
          tagPosition: 'head',
        },
      ],
    },
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
      ignore: ['**/*.ts'],
    },
  ],
  imports: {
    dirs: [
      // ドメイン別サブディレクトリまでスキャンする（デフォルトは直下のみ）
      'composables/**',
      'utils/**',
    ],
  },
  runtimeConfig: {
    apiInternalBase: process.env.NUXT_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000',
    public: {
      // 未指定時は相対パス（`vite.server.proxy` 経由で Laravel へ）。本番・Vercel では必ず絶対 URL を .env で指定すること。
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
      // Cognito の client_id / redirect_uri はバックエンドのみが保持する
      reverbKey: process.env.NUXT_PUBLIC_REVERB_KEY || 'local-key',
      reverbHost: process.env.NUXT_PUBLIC_REVERB_HOST || '127.0.0.1',
      reverbPort: Number(process.env.NUXT_PUBLIC_REVERB_PORT || 8080),
      reverbScheme: process.env.NUXT_PUBLIC_REVERB_SCHEME || 'http',
    },
  },
  vite: {
    resolve: {
      alias: {
        '#shared': sharedDir,
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (source: string, filename: string) => {
            const file = filename.replace(/\\/g, '/').split('?')[0]
            // mixin 本体とその分割ファイルへ注入すると循環参照になる
            if (
              file.endsWith('/assets/styles/_mixin.scss') ||
              file.endsWith('/assets/styles/mixin.scss') ||
              file.includes('/assets/styles/mixins/')
            ) {
              return source
            }
            if (source.includes('@use "~/assets/styles/mixin" as mixin')) {
              return source
            }
            return `@use "~/assets/styles/mixin" as mixin;\n${source}`
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        '@tanstack/vue-query',
        '@vueuse/core',
        '@floating-ui/dom',
        'lucide-vue-next',
        'laravel-echo',
        'pusher-js',
        'zod',
      ],
    },
    server: {
      fs: {
        allow: [rootDir, sharedDir],
      },
      proxy: {
        // ブラウザ → :3000/api/* を Laravel へ転送（CORS・WSL のループバック差を避ける）
        // ポート競合で artisan が 8001 等になったときは NUXT_DEV_API_PROXY_TARGET で上書き
        '/api': {
          target: process.env.NUXT_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // アバター等の公開ストレージ（ローカル public ディスク時。S3 は絶対 URL）
        '/storage': {
          target: process.env.NUXT_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  },
})
