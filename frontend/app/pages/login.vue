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
<style lang="scss" scoped src="~/assets/styles/pages/login.scss"></style>
