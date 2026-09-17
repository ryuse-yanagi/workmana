<template>
  <main class="page">
    <h1>組織への参加登録</h1>

    <section v-if="loading" class="card">
      <p class="muted">招待情報を確認しています…</p>
    </section>

    <section v-else-if="status !== 'active'" class="card">
      <p class="err">{{ statusMessage }}</p>
      <p class="muted">
        新しい招待が必要な場合は、組織の管理者に連絡してください。
      </p>
      <NuxtLink to="/login" class="link-btn">ログインへ</NuxtLink>
    </section>

    <section v-else-if="completed" class="card">
      <p class="ok">{{ completedMessage }}</p>
      <p class="muted">
        Cognito でログインすると、組織「{{ organizationName }}」を利用できます。
      </p>
      <NuxtLink
        :to="loginPath"
        class="link-btn"
      >
        ログインへ
      </NuxtLink>
    </section>

    <section v-else class="card">
      <p class="muted">
        「{{ organizationName }}」へ招待されています。
        パスワードと名前を入力して登録を完了してください。
      </p>

      <p v-if="errorMessage" class="err">{{ errorMessage }}</p>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="label">メールアドレス</span>
          <input
            :value="email"
            type="email"
            class="input"
            readonly
            tabindex="-1"
          >
        </label>
        <label class="field">
          <span class="label">名前</span>
          <input
            v-model="name"
            type="text"
            class="input"
            maxlength="20"
            autocomplete="name"
            required
            :disabled="submitting"
          >
        </label>
        <label class="field">
          <span class="label">パスワード</span>
          <input
            v-model="password"
            type="password"
            class="input"
            minlength="8"
            autocomplete="new-password"
            required
            :disabled="submitting"
          >
        </label>
        <p class="hint">パスワードは8文字以上にしてください。</p>
        <button type="submit" :disabled="submitting || !name.trim() || password.length < 8">
          {{ submitting ? '登録中…' : '登録して参加' }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
type InviteStatus = 'active' | 'used' | 'expired' | 'invalid' | 'error'

type InvitePreview = {
  status: InviteStatus
  message?: string | null
  email?: string
  organization?: {
    id: number
    name: string
    slug: string
  }
}

definePageMeta({
  name: 'invite-token',
})

const route = useRoute()
const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')

const token = computed(() => String(route.params.token || ''))

const loading = ref(true)
const status = ref<InviteStatus>('invalid')
const statusMessage = ref('招待が見つかりません。')
const email = ref('')
const organizationName = ref('')
const organizationSlug = ref('')
const name = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const completed = ref(false)
const completedMessage = ref('参加が完了しました。')

const loginPath = computed(() => {
  const next = organizationSlug.value
    ? `/org/${organizationSlug.value}/workspaces`
    : '/'
  return { path: '/login', query: { next } }
})

function applyPreview (preview: InvitePreview) {
  status.value = preview.status
  statusMessage.value = preview.message || (
    preview.status === 'used'
      ? 'この招待は使用済みです'
      : preview.status === 'expired'
        ? 'この招待の有効期限が切れています。'
        : '招待を利用できません。'
  )
  email.value = preview.email || ''
  organizationName.value = preview.organization?.name || ''
  organizationSlug.value = preview.organization?.slug || ''
}

async function loadInvite () {
  loading.value = true
  errorMessage.value = ''
  completed.value = false

  if (!token.value) {
    status.value = 'invalid'
    statusMessage.value = '招待が見つかりません。'
    loading.value = false
    return
  }

  try {
    const preview = await $fetch<InvitePreview>(
      `${apiBase}/invites/${encodeURIComponent(token.value)}`,
      { credentials: 'include' },
    )
    applyPreview(preview)
  } catch (error: unknown) {
    const data = error && typeof error === 'object'
      ? (error as { data?: InvitePreview }).data
      : undefined
    if (data && typeof data === 'object' && data.status) {
      applyPreview(data)
    } else {
      status.value = 'invalid'
      statusMessage.value = '招待が見つかりません。'
    }
  } finally {
    loading.value = false
  }
}

async function submit () {
  errorMessage.value = ''
  submitting.value = true
  const { api } = useApi()
  try {
    const res = await api<{ message: string, organization?: { name: string, slug: string } }>(
      `/invites/${encodeURIComponent(token.value)}/accept`,
      {
        method: 'POST',
        body: {
          name: name.value.trim(),
          password: password.value,
        },
      },
    )
    completed.value = true
    completedMessage.value = res.message || '参加が完了しました。'
    if (res.organization?.name) {
      organizationName.value = res.organization.name
    }
    if (res.organization?.slug) {
      organizationSlug.value = res.organization.slug
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '登録に失敗しました。'
    if (errorMessage.value.includes('使用済み')) {
      status.value = 'used'
      statusMessage.value = 'この招待は使用済みです'
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadInvite()
})

watch(token, () => {
  void loadInvite()
})
</script>

<style lang="scss" scoped src="~/assets/styles/pages/invite.scss"></style>
