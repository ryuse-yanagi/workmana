<template>
  <AuthGateShell
    title="アカウント作成"
    subtitle="ユーザーアカウントを作成します。組織の作成はログイン後に行います。"
    :busy="bootstrapping"
    busy-label="ログイン状態を確認しています…"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>

    <form v-if="!completed" class="auth-form" autocomplete="off" novalidate @submit.prevent="submit">
      <label class="auth-field">
        <span class="auth-label">ユーザー名</span>
        <input
          v-model="name"
          type="text"
          class="auth-input"
          :maxlength="USER_NAME_MAX_LENGTH"
          name="register-name"
          autocomplete="off"
          aria-required="true"
          :disabled="submitting"
        >
        <p v-if="nameError" class="auth-field-error">{{ nameError }}</p>
      </label>
      <label class="auth-field">
        <span class="auth-label">メールアドレス</span>
        <input
          v-model="email"
          type="email"
          class="auth-input"
          :maxlength="EMAIL_MAX_LENGTH"
          name="register-email"
          autocomplete="off"
          aria-required="true"
          :disabled="submitting"
        >
        <p v-if="emailError" class="auth-field-error">{{ emailError }}</p>
      </label>
      <label class="auth-field">
        <span class="auth-label">パスワード</span>
        <input
          v-model="password"
          type="password"
          class="auth-input"
          :maxlength="PASSWORD_MAX_LENGTH"
          name="register-password"
          autocomplete="new-password"
          aria-required="true"
          :disabled="submitting"
        >
        <p v-if="passwordError" class="auth-field-error">{{ passwordError }}</p>
      </label>
      <p class="auth-hint">パスワードは8文字以上にしてください。</p>
      <button type="submit" class="auth-btn auth-btn--block" :disabled="submitting">
        {{ submitting ? '作成中…' : 'アカウントを作成' }}
      </button>
    </form>

    <div v-else class="auth-success">
      <p class="auth-copy">
        アカウントを作成しました。続けてログインし、組織を作成してください。
      </p>
      <button type="button" class="auth-btn auth-btn--block" @click="goLogin">
        ログインして組織を作成
      </button>
    </div>

    <template #footer>
      既にアカウントをお持ちの方は
      <NuxtLink to="/login">ログイン</NuxtLink>
    </template>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useApi } from '../composables/shared/useApi'
import { useAuth } from '../composables/auth/useAuth'
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '../constants/fieldLengthLimits'
import { emailFieldError, passwordFieldError, requiredTextFieldError } from '../utils/shared/formValidation'

defineOptions({ name: 'register' })

definePageMeta({
  name: 'register',
  keepalive: false,
})

const { api } = useApi()
const { startLogin, fetchSession } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const completed = ref(false)
const bootstrapping = ref(false)
const errorMessage = ref('')
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const passwordError = ref<string | null>(null)

function goLogin () {
  startLogin('/organizations/new')
}

async function submit () {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  nameError.value = requiredTextFieldError(name.value, 'ユーザー名', USER_NAME_MAX_LENGTH)
  emailError.value = emailFieldError(email.value)
  passwordError.value = passwordFieldError(password.value)
  if (nameError.value || emailError.value || passwordError.value) {
    submitting.value = false
    return
  }

  try {
    await api('/auth/register', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
      },
    })
    completed.value = true
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'アカウント作成に失敗しました。'
  } finally {
    submitting.value = false
  }
}

function resetRegisterForm () {
  name.value = ''
  email.value = ''
  password.value = ''
  submitting.value = false
  completed.value = false
  errorMessage.value = ''
  nameError.value = null
  emailError.value = null
  passwordError.value = null
}

watch(name, () => { if (nameError.value) nameError.value = null })
watch(email, () => { if (emailError.value) emailError.value = null })
watch(password, () => { if (passwordError.value) passwordError.value = null })

onActivated(() => {
  resetRegisterForm()
})

onMounted(async () => {
  resetRegisterForm()
  try {
    const session = await fetchSession()
    if (session.authenticated) {
      bootstrapping.value = false
      await navigateTo('/post-login')
      return
    }
  } catch {
    // セッション確認失敗時は登録フォームを出す
  } finally {
    bootstrapping.value = false
  }
})
</script>
