<script setup lang="ts">
/**
 * 未定義パスの受け皿。所属組織のスペース一覧（未ログインはログイン）へ退避する。
 */
import { useAuth } from '../composables/useAuth'
import { useOrganizationContext } from '../composables/useOrganizationContext'

definePageMeta({
  authShell: true,
})

const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

onMounted(async () => {
  try {
    const session = await fetchSession()
    if (session.authenticated) {
      await navigateTo(await resolvePostLoginPath(session.user), { replace: true })
      return
    }
  } catch {
    // fall through
  }
  await navigateTo('/login', { replace: true })
})
</script>

<template>
  <AuthGateShell
    title="移動中"
    subtitle="適切な画面へ移動しています…"
    :busy="true"
    busy-label="移動しています…"
  />
</template>
