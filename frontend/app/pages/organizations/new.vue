<template>
  <main class="page">
    <h1>組織の作成</h1>
    <p class="muted">
      最初に作成したあなたが、この組織の管理者になります。
    </p>

    <section class="card">
      <p v-if="checking" class="muted">確認中…</p>
      <template v-else>
        <p v-if="errorMessage" class="err">{{ errorMessage }}</p>
        <form class="form" novalidate @submit.prevent="submit">
          <label class="field">
            <span class="label">組織名</span>
            <input
              v-model="name"
              type="text"
              class="input"
              :maxlength="ORGANIZATION_NAME_MAX_LENGTH"
              autocomplete="organization"
              aria-required="true"
              :disabled="submitting"
            >
            <p v-if="nameError" class="field-error">{{ nameError }}</p>
          </label>
          <button type="submit" :disabled="submitting">
            {{ submitting ? '作成中…' : '組織を作成' }}
          </button>
        </form>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useApi } from '../../composables/useApi'
import { useAuth } from '../../composables/useAuth'
import { useOrganizationContext } from '../../composables/useOrganizationContext'
import { ORGANIZATION_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../utils/formValidation'

definePageMeta({
  name: 'organizations-new',
})

const { api } = useApi()
const { fetchSession } = useAuth()
const { orgTopPath } = useOrganizationContext()

const checking = ref(true)
const name = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const nameError = ref<string | null>(null)

async function submit () {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  nameError.value = requiredTextFieldError(name.value, '組織名を入力してください。')
  if (nameError.value) {
    submitting.value = false
    return
  }

  try {
    const org = await api<{ id: number, name: string, slug: string }>('/organizations', {
      method: 'POST',
      body: { name: name.value.trim() },
    })
    await navigateTo(orgTopPath(org.slug))
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '組織の作成に失敗しました。'
  } finally {
    submitting.value = false
  }
}

watch(name, () => { if (nameError.value) nameError.value = null })

onMounted(async () => {
  const session = await fetchSession()
  if (!session.authenticated) {
    await navigateTo({ path: '/login', query: { next: '/organizations/new' } })
    return
  }
  const orgs = session.user?.organizations ?? []
  if (orgs.length > 0) {
    await navigateTo('/post-login')
    return
  }
  checking.value = false
})
</script>

<style lang="scss" scoped src="~/assets/styles/pages/invite.scss"></style>
