<template>
  <AuthGateShell
    :title="shellTitle"
    :subtitle="shellSubtitle"
    :busy="loading"
    busy-label="招待情報を確認しています…"
  >
    <template v-if="!loading && status !== 'active'">
      <p class="auth-err" role="alert">{{ statusMessage }}</p>
      <p class="auth-copy">
        新しい招待が必要な場合は、組織の管理者に連絡してください。
      </p>
      <NuxtLink to="/login" class="auth-btn auth-btn--block">ログインへ</NuxtLink>
    </template>

    <template v-else-if="!loading && canConfirmAsSignedIn">
      <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
      <p class="auth-copy">招待先: {{ email }}</p>
      <button
        type="button"
        class="auth-btn auth-btn--block"
        :disabled="submitting"
        @click="confirmAsSignedIn"
      >
        参加する
      </button>
    </template>

    <template v-else-if="!loading && signedInEmail">
      <p class="auth-err" role="alert">この招待は {{ email }} 宛です。ログイン中のアカウントでは参加できません。</p>
      <NuxtLink :to="loginPath" class="auth-btn auth-btn--block" @click="rememberInviteReturn">
        招待されたアカウントでログイン
      </NuxtLink>
    </template>

    <template v-else-if="!loading && !cognitoConfigured">
      <p class="auth-copy">
        招待先は {{ email }} です。この環境では Cognito を使わずにログインします。ログインしたアカウントのメールアドレスが招待先と一致すると参加できます。
      </p>
      <NuxtLink :to="loginPath" class="auth-btn auth-btn--block" @click="rememberInviteReturn">
        ログインして参加
      </NuxtLink>
    </template>

    <template v-else-if="!loading">
      <p class="auth-copy">
        招待先は {{ email }} です。Cognito の画面でもこのメールアドレスを使ってください。アカウントが無い場合は、その画面から登録できます。
      </p>
      <button
        type="button"
        class="auth-btn auth-btn--block"
        @click="continueWithCognito"
      >
        ログインまたは登録して参加
      </button>
    </template>
  </AuthGateShell>
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
const { session, fetchSession, patchSessionUser, startLogin } = useAuth()

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
const cognitoConfigured = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

const invitePath = computed(() => `/invite/${token.value}`)

const loginPath = computed(() => {
  const query: Record<string, string> = { next: invitePath.value }
  if (email.value) {
    query.login_hint = email.value
  }
  if (signedInEmail.value) {
    query.reauth = '1'
  }
  return { path: '/login', query }
})

const canConfirmAsSignedIn = computed(() => {
  const current = signedInEmail.value?.trim().toLowerCase()
  const invited = email.value.trim().toLowerCase()
  return Boolean(current && invited && current === invited)
})

const shellTitle = computed(() => {
  if (loading.value) {
    return '組織への参加'
  }
  if (status.value !== 'active') {
    return '招待を確認できません'
  }
  return '組織への参加'
})

const shellSubtitle = computed(() => {
  if (loading.value) {
    return '招待リンクから、組織への参加を完了します。'
  }
  if (status.value !== 'active') {
    return '招待リンクの状態を確認できませんでした。'
  }
  if (canConfirmAsSignedIn.value) {
    return `「${organizationName.value}」へ招待されています。ログイン中のアカウントで参加します。`
  }
  if (signedInEmail.value) {
    return '招待されたメールアドレスのアカウントでログインしてください。'
  }
  return `「${organizationName.value}」へ招待されています。ログインまたは登録のあと、この画面で参加を確定します。`
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

function continueWithCognito () {
  rememberInviteReturn()
  startLogin(invitePath.value, email.value)
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

async function loadInvite () {
  submitting.value = false
  errorMessage.value = ''
  loading.value = true

  try {
    const auth = await fetchSession()
    signedInEmail.value = auth.authenticated ? (auth.user?.email ?? null) : null
    cognitoConfigured.value = auth.configured
  } catch {
    signedInEmail.value = null
    cognitoConfigured.value = false
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
    if (import.meta.client) {
      sessionStorage.removeItem('tm:pending_invite')
    }
    await navigateTo(`/org/${organization.slug}/workspaces`)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '参加に失敗しました。'
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
