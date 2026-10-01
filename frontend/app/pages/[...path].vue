<script setup lang="ts">
/**
 * 未定義パスの受け皿。所属組織のスペース一覧（未ログインはログイン）へ退避する。
 */
import { useAuth } from '../composables/auth/useAuth'
import { useOrganizationContext } from '../composables/org/useOrganizationContext'

definePageMeta({
  name: 'unknown-path',
  authShell: true,
  keepalive: false,
})

const { fetchSession, startLogin } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

const session = await fetchSession()
if (session.authenticated) {
  try {
    await navigateTo(await resolvePostLoginPath(session.user), { replace: true })
  } catch {
    await navigateTo('/login', { replace: true })
  }
} else if (session.configured) {
  if (import.meta.client) {
    startLogin('/post-login')
  } else {
    await navigateTo('/login', { replace: true })
  }
} else {
  await navigateTo('/login', { replace: true })
}
</script>

<template>
  <AuthGateShell
    title="移動中"
    subtitle="適切な画面へ移動しています…"
    :busy="true"
    busy-label="移動しています…"
  />
</template>
