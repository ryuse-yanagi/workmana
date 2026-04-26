/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      // 未指定時は相対パス（`vite.server.proxy` 経由で Laravel へ）。本番・Vercel では必ず絶対 URL を .env で指定すること。
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
<<<<<<< HEAD
      cognitoDomain: process.env.NUXT_PUBLIC_COGNITO_DOMAIN || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
      cognitoRedirectUri: process.env.NUXT_PUBLIC_COGNITO_REDIRECT_URI || '',
      cognitoLogoutRedirectUri: process.env.NUXT_PUBLIC_COGNITO_LOGOUT_REDIRECT_URI || '',
=======
>>>>>>> main
    },
  },
  vite: {
    server: {
      proxy: {
        // ブラウザ → :3000/api/* を :8000/api/* に転送（CORS・WSL のループバック差を避ける）
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  },
})
