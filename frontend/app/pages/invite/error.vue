<template>
  <AuthGateShell
    title="招待を確認できません"
    :subtitle="subtitle"
  >
    <p class="auth-err" role="alert">{{ message }}</p>
    <p class="auth-copy">
      新しい招待が必要な場合は、組織の管理者に連絡してください。
    </p>
    <div class="auth-actions">
      <NuxtLink :to="primaryAction.to" class="auth-btn">
        {{ primaryAction.label }}
      </NuxtLink>
    </div>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useAuth } from '../../composables/useAuth'
import { useOrganizationContext } from '../../composables/useOrganizationContext'

definePageMeta({
  name: 'invite-error',
})

const route = useRoute()
const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

const message = computed(() => {
  const raw = route.query.message
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim()
  }
  return '招待が見つかりません。'
})

const subtitle = computed(() => '招待リンクの状態を確認できませんでした。')

const primaryAction = ref<{ to: string; label: string }>({
  to: '/login',
  label: 'ログインへ',
})

onMounted(async () => {
  try {
    const session = await fetchSession()
    if (session.authenticated) {
      const path = await resolvePostLoginPath(session.user)
      primaryAction.value = { to: path, label: 'スペース一覧へ' }
      return
    }
  } catch {
    // 未ログイン向けのまま
  }
  primaryAction.value = { to: '/login', label: 'ログインへ' }
})
</script>
