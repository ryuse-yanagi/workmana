<template>
  <AuthGateShell
    title="移動中"
    subtitle="Cognito の認証画面へ移動しています…"
    :busy="true"
    busy-label="移動しています…"
  />
</template>

<script setup lang="ts">
import { safeInternalPath } from '../utils/auth/safeInternalPath'

definePageMeta({
  name: 'register',
  keepalive: false,
})

const route = useRoute()
const { fetchSession, startLogin } = useAuth()

function resolveNext (): string {
  const raw = route.query.next
  if (raw === undefined || raw === null || raw === '') {
    if (import.meta.client) {
      const pending = sessionStorage.getItem('tm:pending_invite')
      if (pending && pending.startsWith('/invite/')) {
        return pending
      }
    }
    return '/post-login'
  }
  const value = Array.isArray(raw) ? raw[0] : raw
  return safeInternalPath(value, '/post-login')
}

onMounted(() => {
  void (async () => {
    try {
      const session = await fetchSession()
      if (session.authenticated) {
        await navigateTo('/post-login', { replace: true })
        return
      }
      if (session.configured) {
        startLogin(resolveNext())
        return
      }
    } catch {
      // セッション確認に失敗した場合はログイン画面へ戻す
    }
    await navigateTo('/login', { replace: true })
  })()
})
</script>
