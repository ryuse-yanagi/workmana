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
    : '/org/acme/workspaces'
  window.location.href = buildLoginUrl(next)
}
</script>
<style lang="scss" scoped>
.page { max-width: 448px; margin: 28px auto; padding: 0 14px; }
.muted { color: #64748b; }
.card { margin-top: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; }
.err { color: #b91c1c; margin-bottom: 10.5px; }
button {
  padding: 7px 14px; border-radius: 6px; border: none; background: #0f172a; color: white;
  cursor: pointer; font-size: 12.6px;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
