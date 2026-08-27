<template>
  <AuthGateShell
    :title="shellTitle"
    :subtitle="shellSubtitle"
    :busy="loading"
    busy-label="招待情報を確認しています…"
  >
    <template v-if="status !== 'active'">
      <p class="auth-err" role="alert">{{ statusMessage }}</p>
      <p class="auth-copy">
        新しい招待が必要な場合は、組織の管理者に連絡してください。
      </p>
      <div class="auth-actions">
        <NuxtLink to="/login" class="auth-btn">ログインへ</NuxtLink>
      </div>
    </template>

    <template v-else-if="completed">
      <div class="auth-success">
        <p v-if="!joinAuthenticated" class="auth-copy">
          Cognito でログインすると、組織「{{ organizationName }}」を利用できます。
        </p>
        <p v-else class="auth-copy">
          組織「{{ organizationName }}」への参加が完了しました。
        </p>
        <button
          v-if="joinAuthenticated"
          type="button"
          class="auth-btn auth-btn--block"
          @click="goJoinedOrg"
        >
          組織へ進む
        </button>
        <NuxtLink
          v-else
          :to="loginPath"
          class="auth-btn auth-btn--block"
        >
          ログインへ
        </NuxtLink>
      </div>
    </template>

    <!-- 既存アカウント: ログイン済み・メール一致 → 参加確認 -->
    <template v-else-if="requiresAuthentication && sessionChecked && sessionMatchesInvite">
      <p class="auth-copy">
        「{{ organizationName }}」へ招待されています（{{ email }}）。
      </p>
      <p class="auth-copy auth-copy--strong">
        「{{ organizationName }}」へ参加しますか？
      </p>
      <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
      <div class="auth-actions">
        <button
          type="button"
          class="auth-btn"
          :disabled="accepting"
          @click="acceptAuthenticated"
        >
          {{ accepting ? '参加中…' : '参加する' }}
        </button>
        <button
          type="button"
          class="auth-btn auth-btn--secondary"
          :disabled="accepting"
          @click="declineJoin"
        >
          キャンセル
        </button>
      </div>
    </template>

    <!-- 既存アカウント: 別ユーザーでログイン中 -->
    <template v-else-if="requiresAuthentication && sessionChecked && sessionAuthenticated && !sessionMatchesInvite">
      <p class="auth-copy">
        「{{ organizationName }}」へ招待されています（{{ email }}）。
      </p>
      <p class="auth-err" role="alert">
        別のアカウント（{{ sessionEmail }}）でログイン中です。
        招待されたメールアドレスのアカウントに切り替えるか、一度ログアウトしてください。
      </p>
      <div class="auth-actions">
        <button type="button" class="auth-btn" @click="logoutAndRelogin">
          ログアウトして招待アカウントでログイン
        </button>
        <NuxtLink to="/login" class="auth-btn auth-btn--secondary">ログイン画面へ</NuxtLink>
      </div>
    </template>

    <!-- 既存アカウント: 未ログイン -->
    <template v-else-if="requiresAuthentication">
      <p class="auth-copy">
        「{{ organizationName }}」へ招待されています（{{ email }}）。
      </p>
      <p class="auth-copy auth-copy--strong">
        既存アカウントです。招待されたメールでログインしたあと、参加確認が表示されます。
      </p>
      <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
      <button
        type="button"
        class="auth-btn auth-btn--block"
        @click="goLoginToAccept"
      >
        ログインして参加確認へ
      </button>
    </template>

    <!-- 新規ユーザー登録 -->
    <template v-else>
      <p class="auth-copy">
        「{{ organizationName }}」へ招待されています。
        パスワードと名前を入力して登録を完了してください。
      </p>

      <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>

      <form class="auth-form" novalidate @submit.prevent="submitRegistration">
        <label class="auth-field">
          <span class="auth-label">メールアドレス</span>
          <input
            :value="email"
            type="text"
            inputmode="email"
            class="auth-input"
            readonly
            tabindex="-1"
          >
        </label>
        <label class="auth-field">
          <span class="auth-label">名前</span>
          <input
            v-model="name"
            type="text"
            class="auth-input"
            :maxlength="USER_NAME_MAX_LENGTH"
            autocomplete="name"
            aria-required="true"
            :disabled="submitting"
          >
          <p v-if="nameError" class="auth-field-error">{{ nameError }}</p>
        </label>
        <label class="auth-field">
          <span class="auth-label">パスワード</span>
          <input
            v-model="password"
            type="password"
            class="auth-input"
            :maxlength="PASSWORD_MAX_LENGTH"
            autocomplete="new-password"
            aria-required="true"
            :disabled="submitting"
          >
          <p v-if="passwordError" class="auth-field-error">{{ passwordError }}</p>
        </label>
        <p class="auth-hint">パスワードは8文字以上にしてください。</p>
        <button type="submit" class="auth-btn auth-btn--block" :disabled="submitting">
          {{ submitting ? '登録中…' : '登録して参加' }}
        </button>
      </form>
    </template>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useAuth } from '../../composables/useAuth'
import { useApi } from '../../composables/useApi'
import { useOrganizationContext } from '../../composables/useOrganizationContext'
import { PASSWORD_MAX_LENGTH, USER_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { passwordFieldError, requiredTextFieldError } from '../../utils/formValidation'
import { clearSessionScopedCaches } from '../../composables/useSessionScopedCaches'

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
  account_exists?: boolean
  requires_authentication?: boolean
}

definePageMeta({
  name: 'invite-token',
})

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
const { startLogin, fetchSession, logout } = useAuth()
const { orgTopPath } = useOrganizationContext()

const token = computed(() => String(route.params.token || ''))

const loading = ref(true)
const status = ref<InviteStatus>('invalid')
const statusMessage = ref('招待が見つかりません。')
const email = ref('')
const organizationName = ref('')
const organizationSlug = ref('')
const requiresAuthentication = ref(false)
const name = ref('')
const password = ref('')
const submitting = ref(false)
const accepting = ref(false)
const errorMessage = ref('')
const nameError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const completed = ref(false)
const joinAuthenticated = ref(false)
const sessionChecked = ref(false)
const sessionAuthenticated = ref(false)
const sessionMatchesInvite = ref(false)
const sessionEmail = ref('')

const loginPath = computed(() => {
  const next = organizationSlug.value
    ? orgTopPath(organizationSlug.value)
    : '/post-login'
  return { path: '/login', query: { next } }
})

const shellTitle = computed(() => {
  if (loading.value) return '組織への参加'
  if (completed.value) return '参加完了'
  if (status.value !== 'active') return '招待を確認できません'
  return '組織への参加'
})

const shellSubtitle = computed(() => {
  if (loading.value) return '招待リンクの内容を確認しています。'
  if (completed.value && organizationName.value) {
    return `「${organizationName.value}」への手続きが完了しました。`
  }
  if (status.value === 'active' && organizationName.value) {
    return `「${organizationName.value}」からの招待です。`
  }
  return '招待リンクの状態を確認してください。'
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
  requiresAuthentication.value = preview.requires_authentication === true
}

async function refreshSessionContext () {
  sessionChecked.value = false
  const session = await fetchSession()
  sessionAuthenticated.value = session.authenticated
  sessionEmail.value = (session.user?.email || '').trim()
  const userEmail = sessionEmail.value.toLowerCase()
  const inviteEmail = email.value.trim().toLowerCase()
  sessionMatchesInvite.value = Boolean(
    session.authenticated
    && userEmail
    && inviteEmail
    && userEmail === inviteEmail,
  )
  sessionChecked.value = true
}

async function acceptAuthenticated () {
  if (!token.value || accepting.value) return
  accepting.value = true
  errorMessage.value = ''
  const { api } = useApi()
  try {
    const res = await api<{
      message: string
      authenticated?: boolean
      organization?: { name: string, slug: string }
    }>(
      `/invites/${encodeURIComponent(token.value)}/accept`,
      { method: 'POST', body: {} },
    )
    completed.value = true
    joinAuthenticated.value = res.authenticated === true
    if (res.organization?.name) {
      organizationName.value = res.organization.name
    }
    if (res.organization?.slug) {
      organizationSlug.value = res.organization.slug
    }
    if (joinAuthenticated.value && organizationSlug.value) {
      await navigateTo(orgTopPath(organizationSlug.value))
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '参加に失敗しました。'
  } finally {
    accepting.value = false
  }
}

async function loadInvite () {
  loading.value = true
  errorMessage.value = ''
  completed.value = false
  joinAuthenticated.value = false
  sessionChecked.value = false

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
    if (preview.status === 'active' && preview.requires_authentication) {
      await refreshSessionContext()
    }
  } catch (error: unknown) {
    const data = error && typeof error === 'object'
      ? (error as { data?: InvitePreview }).data
      : undefined
    if (data && typeof data === 'object' && data.status) {
      applyPreview(data)
      if (data.status === 'active' && data.requires_authentication) {
        await refreshSessionContext()
      }
    } else {
      status.value = 'invalid'
      statusMessage.value = '招待が見つかりません。'
    }
  } finally {
    loading.value = false
  }
}

function goLoginToAccept () {
  startLogin(`/invite/${encodeURIComponent(token.value)}`)
}

async function logoutAndRelogin () {
  if (import.meta.client && token.value) {
    sessionStorage.setItem('tm:pending_invite', `/invite/${encodeURIComponent(token.value)}`)
  }
  clearSessionScopedCaches()
  await logout()
}

function declineJoin () {
  void router.push('/post-login')
}

function goJoinedOrg () {
  if (organizationSlug.value) {
    void navigateTo(orgTopPath(organizationSlug.value))
  }
}

async function submitRegistration () {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  nameError.value = requiredTextFieldError(name.value, '名前', USER_NAME_MAX_LENGTH)
  passwordError.value = passwordFieldError(password.value)
  if (nameError.value || passwordError.value) {
    submitting.value = false
    return
  }
  const { api } = useApi()
  try {
    const res = await api<{
      message: string
      authenticated?: boolean
      organization?: { name: string, slug: string }
    }>(
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
    joinAuthenticated.value = false
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

watch(name, () => {
  if (nameError.value) nameError.value = null
})
watch(password, () => {
  if (passwordError.value) passwordError.value = null
})

onMounted(() => {
  if (import.meta.client && token.value) {
    const pending = sessionStorage.getItem('tm:pending_invite')
    if (pending && pending.includes(token.value)) {
      sessionStorage.removeItem('tm:pending_invite')
    }
  }
  void loadInvite()
})

watch(token, () => {
  void loadInvite()
})
</script>
