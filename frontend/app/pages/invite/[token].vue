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
        :to="loginAfterRegisterPath"
        class="link-btn"
      >
        ログインへ
      </NuxtLink>
    </section>

    <section v-else-if="canConfirmAsSignedIn" class="card">
      <p class="muted">
        「{{ organizationName }}」へ招待されています。
        ログイン中のアカウントで参加します。
      </p>
      <p v-if="errorMessage" class="err">{{ errorMessage }}</p>
      <button type="button" :disabled="submitting" @click="confirmAsSignedIn">
        {{ submitting ? '参加中…' : '参加する' }}
      </button>
    </section>

    <section v-else-if="signedInEmail" class="card">
      <p class="err">この招待は {{ email }} 宛です。ログイン中のアカウントでは参加できません。</p>
      <NuxtLink :to="loginPath" class="link-btn" @click="rememberInviteReturn">招待されたアカウントでログイン</NuxtLink>
    </section>

    <section v-else class="card">
      <p class="muted">
        「{{ organizationName }}」へ招待されています。
        パスワードと名前を入力して登録を完了してください。
      </p>

      <p v-if="errorMessage" class="err">{{ errorMessage }}</p>

      <form class="form" autocomplete="off" @submit.prevent="submit">
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
            name="invite-name"
            autocomplete="off"
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
            name="invite-password"
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
      <p class="muted">
        すでにアカウントがある場合は、ログインしてから参加してください。
      </p>
      <NuxtLink :to="loginPath" class="link-btn" @click="rememberInviteReturn">ログインして参加</NuxtLink>
    </section>
  </main>
</template>

<script setup lang="ts">
type InviteStatus = 'active' | 'used' | 'expired' | 'invalid' | 'error'

type InvitePreview = {
  status: InviteStatus
  message?: string | null
  email?: string
  role?: string
  organization?: {
    id: number
    name: string
    slug: string
  }
}

defineOptions({ name: 'invite-token' })

definePageMeta({
  name: 'invite-token',
  keepalive: false,
})

const route = useRoute()
const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
const { session, fetchSession, patchSessionUser } = useAuth()

const token = computed(() => String(route.params.token || ''))

const loading = ref(true)
const status = ref<InviteStatus>('invalid')
const statusMessage = ref('招待が見つかりません。')
const email = ref('')
const organizationId = ref<number | null>(null)
const organizationName = ref('')
const organizationSlug = ref('')
const inviteRole = ref('member')
const signedInEmail = ref<string | null>(null)
const name = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const completed = ref(false)
const completedMessage = ref('参加が完了しました。')

const invitePath = computed(() => `/invite/${token.value}`)

const loginAfterRegisterPath = computed(() => {
  const next = organizationSlug.value
    ? `/org/${organizationSlug.value}/workspaces`
    : '/post-login'
  return { path: '/login', query: { next } }
})

const loginPath = computed(() => {
  const next = invitePath.value
  return {
    path: '/login',
    query: signedInEmail.value ? { reauth: '1', next } : { next },
  }
})

const canConfirmAsSignedIn = computed(() => {
  const current = signedInEmail.value?.trim().toLowerCase()
  const invited = email.value.trim().toLowerCase()
  return Boolean(current && invited && current === invited)
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
  organizationId.value = preview.organization?.id ?? null
  organizationName.value = preview.organization?.name || ''
  organizationSlug.value = preview.organization?.slug || ''
  inviteRole.value = preview.role || 'member'
}

function rememberInviteReturn () {
  if (!import.meta.client || !token.value) return
  sessionStorage.setItem('tm:pending_invite', invitePath.value)
}

/** 参加した組織をセッションに足し、直前の組織としても記録する */
function joinOrganizationInSession (organization: { id: number, name: string, slug: string }) {
  const organizations = [...(session.value?.user?.organizations ?? [])]
  if (!organizations.some(item => item.id === organization.id)) {
    organizations.push({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: inviteRole.value,
      icon_url: null,
    })
  }
  patchSessionUser({
    organizations,
    last_organization_id: organization.id,
  })
}

function resetInviteForm () {
  name.value = ''
  password.value = ''
  submitting.value = false
  errorMessage.value = ''
  completed.value = false
}

async function loadInvite () {
  resetInviteForm()
  loading.value = true

  try {
    const auth = await fetchSession()
    signedInEmail.value = auth.authenticated ? (auth.user?.email ?? null) : null
  } catch {
    signedInEmail.value = null
  }

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

/** 参加を確定し、その組織のスペース一覧へ進む */
async function confirmAsSignedIn () {
  if (submitting.value || !canConfirmAsSignedIn.value) return
  errorMessage.value = ''
  submitting.value = true
  const { api } = useApi()
  try {
    const res = await api<{ organization?: { id: number, name: string, slug: string } }>(
      `/invites/${encodeURIComponent(token.value)}/accept`,
      { method: 'POST', body: {} },
    )
    const organization = {
      id: res.organization?.id ?? organizationId.value ?? 0,
      name: res.organization?.name || organizationName.value,
      slug: res.organization?.slug || organizationSlug.value,
    }
    if (!organization.id || !organization.slug) {
      throw new Error('参加先の組織を確認できませんでした。')
    }
    joinOrganizationInSession(organization)
    await navigateTo(`/org/${organization.slug}/workspaces`)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '参加に失敗しました。'
  } finally {
    submitting.value = false
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
    const message = error instanceof Error ? error.message : '登録に失敗しました。'
    if (message === 'Unauthenticated.' || message.includes('Unauthenticated')) {
      rememberInviteReturn()
      await navigateTo(loginPath.value)
      return
    }
    errorMessage.value = message
    if (errorMessage.value.includes('使用済み')) {
      status.value = 'used'
      statusMessage.value = 'この招待は使用済みです'
    }
  } finally {
    submitting.value = false
  }
}

onActivated(() => {
  void loadInvite()
})

onMounted(() => {
  void loadInvite()
})

watch(token, () => {
  void loadInvite()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/invite.scss"></style>

