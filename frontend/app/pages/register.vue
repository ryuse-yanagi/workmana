<template>
  <main class="page">
    <h1>アカウント作成</h1>
    <p class="muted">
      ユーザーアカウントを作成します。組織の作成はログイン後に行います。
    </p>

    <section class="card">
      <p v-if="errorMessage" class="err">{{ errorMessage }}</p>
      <p v-if="completed" class="ok">アカウントを作成しました。ログインしてください。</p>

      <form v-if="!completed" class="form" novalidate @submit.prevent="submit">
        <label class="field">
          <span class="label">ユーザー名</span>
          <input
            v-model="name"
            type="text"
            class="input"
            :maxlength="USER_NAME_MAX_LENGTH"
            autocomplete="name"
            aria-required="true"
            :disabled="submitting"
          >
          <p v-if="nameError" class="field-error">{{ nameError }}</p>
        </label>
        <label class="field">
          <span class="label">メールアドレス</span>
          <input
            v-model="email"
            type="email"
            class="input"
            :maxlength="EMAIL_MAX_LENGTH"
            autocomplete="email"
            aria-required="true"
            :disabled="submitting"
          >
          <p v-if="emailError" class="field-error">{{ emailError }}</p>
        </label>
        <label class="field">
          <span class="label">パスワード</span>
          <input
            v-model="password"
            type="password"
            class="input"
            :maxlength="PASSWORD_MAX_LENGTH"
            autocomplete="new-password"
            aria-required="true"
            :disabled="submitting"
          >
          <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
        </label>
        <p class="hint">パスワードは8文字以上にしてください。</p>
        <button type="submit" :disabled="submitting">
          {{ submitting ? '作成中…' : 'アカウントを作成' }}
        </button>
      </form>

      <button
        v-if="completed"
        type="button"
        class="link-btn"
        @click="goLogin"
      >
        ログインして組織を作成
      </button>

      <p class="footer-link">
        既にアカウントをお持ちの方は
        <NuxtLink to="/login">ログイン</NuxtLink>
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '../constants/fieldLengthLimits'
import { emailFieldError, requiredTextFieldError } from '../utils/formValidation'

const { api } = useApi()
const { startLogin, fetchSession } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const completed = ref(false)
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
  nameError.value = requiredTextFieldError(name.value, 'ユーザー名を入力してください。')
  emailError.value = emailFieldError(email.value)
  if (password.value.length < 8) {
    passwordError.value = 'パスワードは8文字以上にしてください。'
  } else {
    passwordError.value = null
  }
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

watch(name, () => { if (nameError.value) nameError.value = null })
watch(email, () => { if (emailError.value) emailError.value = null })
watch(password, () => { if (passwordError.value) passwordError.value = null })

onMounted(async () => {
  const session = await fetchSession()
  if (session.authenticated) {
    await navigateTo('/post-login')
  }
})
</script>

<style lang="scss" scoped src="~/assets/styles/pages/invite.scss"></style>
<style lang="scss" scoped>
.footer-link {
  margin-top: 14px;
  font-size: 12.6px;
  color: #64748b;
}
.footer-link a {
  color: #0f2945;
  font-weight: 700;
}
</style>
