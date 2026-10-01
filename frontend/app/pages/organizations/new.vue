<template>
  <AuthGateShell
    title="組織の作成"
    subtitle="最初に作成したあなたが、この組織の管理者になります。"
    :busy="checking"
    busy-label="ログイン状態を確認しています…"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>

    <form v-if="!checking" class="auth-form" autocomplete="off" novalidate @submit.prevent="submit">
      <label class="auth-field">
        <span class="auth-label">組織名</span>
        <input
          v-model="name"
          type="text"
          class="auth-input"
          :maxlength="ORGANIZATION_NAME_MAX_LENGTH"
          name="organization-name"
          autocomplete="off"
          aria-required="true"
          :disabled="submitting"
        >
        <p v-if="nameError" class="auth-field-error">{{ nameError }}</p>
      </label>
      <button type="submit" class="auth-btn auth-btn--block" :disabled="submitting">
        {{ submitting ? '作成中…' : '組織を作成' }}
      </button>
      <button
        v-if="returnOrgSlug"
        type="button"
        class="auth-btn auth-btn--block auth-btn--secondary"
        :disabled="submitting"
        @click="cancel"
      >
        キャンセル
      </button>
    </form>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useApi } from '../../composables/shared/useApi'
import { useAuth } from '../../composables/auth/useAuth'
import { useOrganizationContext } from '../../composables/org/useOrganizationContext'
import { ORGANIZATION_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../utils/shared/formValidation'

defineOptions({ name: 'organizations-new' })

definePageMeta({
  name: 'organizations-new',
  keepalive: false,
})

const { api } = useApi()
const { session, fetchSession, patchSessionUser } = useAuth()
const { orgTopPath } = useOrganizationContext()

const checking = ref(true)
const name = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const nameError = ref<string | null>(null)
const returnOrgSlug = ref<string | null>(null)

/** 作成した組織をセッションへ足し、そのスペース一覧へ進む */
async function submit () {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  nameError.value = requiredTextFieldError(name.value, '組織名', ORGANIZATION_NAME_MAX_LENGTH)
  if (nameError.value) {
    submitting.value = false
    return
  }

  try {
    const org = await api<{ id: number, name: string, slug: string, icon_url?: string | null }>('/organizations', {
      method: 'POST',
      body: { name: name.value.trim() },
    })
    const organizations = [...(session.value?.user?.organizations ?? [])]
    if (!organizations.some(item => item.id === org.id)) {
      organizations.push({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: 'admin',
        icon_url: org.icon_url ?? null,
      })
    }
    patchSessionUser({
      organizations,
      last_organization_id: org.id,
    })
    name.value = ''
    nameError.value = null
    errorMessage.value = ''
    await navigateTo(orgTopPath(org.slug))
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '組織の作成に失敗しました。'
  } finally {
    submitting.value = false
  }
}

/** 戻り先の組織があればそのスペース一覧へ戻す */
async function cancel () {
  const slug = returnOrgSlug.value
  if (!slug || submitting.value) return
  await navigateTo(orgTopPath(slug))
}

function resetCreateForm () {
  name.value = ''
  submitting.value = false
  errorMessage.value = ''
  nameError.value = null
}

watch(name, () => { if (nameError.value) nameError.value = null })

onActivated(() => {
  resetCreateForm()
})

onMounted(async () => {
  resetCreateForm()
  const session = await fetchSession()
  if (!session.authenticated) {
    await navigateTo({ path: '/login', query: { next: '/organizations/new' } })
    return
  }
  const orgs = session.user?.organizations ?? []
  const lastId = session.user?.last_organization_id ?? null
  const preferred = lastId != null ? orgs.find(org => org.id === lastId) : null
  returnOrgSlug.value = (preferred ?? orgs[0])?.slug?.trim() || null
  checking.value = false
})
</script>
