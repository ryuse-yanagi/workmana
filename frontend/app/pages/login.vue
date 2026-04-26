<template>
  <main class="page">
    <h1>ログイン</h1>
    <p class="muted">
      組織ページへ進むには、Cognito でログインしてください。
    </p>

    <section class="card">
      <p v-if="!isConfigured" class="err">
        Cognito 設定が不足しています。`NUXT_PUBLIC_COGNITO_*` を設定してください。
      </p>
      <button type="button" :disabled="!isConfigured" @click="startLogin">
        Cognito でログイン
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const { isConfigured, buildLoginUrl } = useAuth()

function startLogin () {
  if (!isConfigured.value || !import.meta.client) {
    return
  }
  const next = typeof route.query.next === 'string' && route.query.next.startsWith('/')
    ? route.query.next
    : '/org/acme'
  window.location.href = buildLoginUrl(next)
}
</script>

<style scoped>
.page { max-width: 32rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; }
.muted { color: #64748b; }
.card { margin-top: 1rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
.err { color: #b91c1c; margin-bottom: 0.75rem; }
button {
  padding: 0.5rem 1rem; border-radius: 6px; border: none; background: #0f172a; color: white;
  cursor: pointer; font-size: 0.9rem;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
