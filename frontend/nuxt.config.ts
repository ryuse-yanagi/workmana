/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [
    '~/assets/styles/fonts.css',
    '~/assets/styles/_buttons.scss',
    '~/assets/styles/_board-filter.scss',
  ],
  app: {
    head: {
      // 初回ペイント前に隠し、fonts-ready 後に設定どおりの太さで表示する
      style: [
        {
          key: 'fonts-ready-gate',
          textContent: 'html:not(.fonts-ready){visibility:hidden}html.fonts-ready{visibility:visible}',
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
          textContent: '(function(){var d=document.documentElement;if(d.classList.contains("fonts-ready"))return;setTimeout(function(){d.classList.add("fonts-ready")},2500)})();',
          tagPosition: 'head',
        },
      ],
    },
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
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
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (source: string, filename: string) => {
            const file = filename.replace(/\\/g, '/').split('?')[0]
            if (file.endsWith('/assets/styles/_mixin.scss') || file.endsWith('/assets/styles/mixin.scss')) {
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
    server: {
      proxy: {
        // ブラウザ → :3000/api/* を :8000/api/* に転送（CORS・WSL のループバック差を避ける）
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // アバター等の公開ストレージ（API は相対 /storage/... を返す）
        '/storage': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  },
})
