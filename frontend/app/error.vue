<template>
  <AuthGateShell
    title="移動中"
    subtitle="適切な画面へ移動しています…"
    :busy="true"
    busy-label="移動しています…"
  />
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'
import { useAuth } from './composables/auth/useAuth'
import { useOrganizationContext } from './composables/org/useOrganizationContext'

const props = defineProps<{
  error: NuxtError
}>()

const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

onMounted(async () => {
  const status = props.error?.statusCode ?? 500
  // 存在しないページ・到達不能はメンバーのスペース一覧（未ログインはログイン）へ
  if (status === 404 || status === 403) {
    try {
      const session = await fetchSession()
      if (session.authenticated) {
        const path = await resolvePostLoginPath(session.user)
        await clearError({ redirect: path })
        return
      }
    } catch {
      // fall through
    }
    await clearError({ redirect: '/login' })
    return
  }

  // その他のエラーもホーム相当へ退避
  try {
    const session = await fetchSession()
    if (session.authenticated) {
      const path = await resolvePostLoginPath(session.user)
      await clearError({ redirect: path })
      return
    }
  } catch {
    // fall through
  }
  await clearError({ redirect: '/login' })
})
</script>
