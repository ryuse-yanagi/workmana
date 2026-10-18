<template>
  <SettingsPanel title="組織設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="editModalOpen = true"
      >
        <Pencil :size="20" :stroke-width="2.1" aria-hidden="true" />
        組織編集
      </button>
    </template>

    <div class="org-settings-body">
      <div class="org-profile">
        <div class="org-profile__icon-wrap">
          <img
            v-if="iconUrl && !iconFailed"
            :src="iconUrl"
            alt="組織アイコン"
            class="org-profile__icon"
            @error="onIconError"
          />
          <div v-else class="org-profile__placeholder" aria-hidden="true">
            <span class="org-profile__initial">{{ orgInitial }}</span>
          </div>
        </div>

        <dl class="org-fields">
          <div class="org-field">
            <dt class="org-field__label">組織名</dt>
            <dd class="org-field__value">
              <div class="org-field__box">{{ displayName }}</div>
            </dd>
          </div>

          <div class="org-field">
            <dt class="org-field__label">組織コード</dt>
            <dd class="org-field__value">
              <div class="org-field__box">{{ orgSlugDisplay }}</div>
            </dd>
          </div>

          <div class="org-field">
            <dt class="org-field__label">メンバー数</dt>
            <dd class="org-field__value">
              <div class="org-field__box">{{ memberCountLabel }}</div>
            </dd>
          </div>

          <div class="org-field">
            <dt class="org-field__label">作成日</dt>
            <dd class="org-field__value">
              <div class="org-field__box">{{ createdAtLabel }}</div>
            </dd>
          </div>
        </dl>
      </div>

      <section v-if="canManage" class="org-danger">
        <div class="org-danger__copy">
          <h3 class="org-danger__title">組織の削除</h3>
          <p class="org-danger__note">
            組織を削除すると、組織内のすべてのデータが削除されます。この操作は元に戻せません。
          </p>
        </div>
        <button
          type="button"
          class="org-danger__btn"
          @click="deleteModalOpen = true"
        >
          <Trash2 :size="18" :stroke-width="2.1" aria-hidden="true" />
          組織削除
        </button>
      </section>
    </div>

    <OrganizationSettingsModal
      v-model="editModalOpen"
      :org-slug="orgSlug"
      @saved="onOrgSaved"
    />
    <OrganizationDeleteModal
      ref="deleteModalRef"
      v-model="deleteModalOpen"
      :organization-name="displayName"
      :loading="deleting"
      @confirm="confirmDeleteOrganization"
    />
  </SettingsPanel>
</template>
<script setup lang="ts">
import { Pencil, Trash2 } from 'lucide-vue-next'
import { useAuth } from '../../composables/auth/useAuth'
import { useOrganizationContext } from '../../composables/org/useOrganizationContext'
import { invalidateOrgDerivedCaches } from '../../composables/settings/invalidateOrgDerivedCaches'
import { useOrgSettingsPageData } from '../../composables/settings/useOrgSettingsPageData'
import { useApi } from '../../composables/shared/useApi'
import { formatDateDisplay } from '../../composables/task/useTaskFormHelpers'
import OrganizationDeleteModal from '../modals/settings/OrganizationDeleteModal.vue'
import OrganizationSettingsModal from '../modals/settings/OrganizationSettingsModal.vue'
import SettingsPanel from './SettingsPanel.vue'

const props = withDefaults(defineProps<{
  orgSlug: string
  initialName?: string | null
  initialIconUrl?: string | null
  createdAt?: string | null
  memberCount?: number | null
  canManage?: boolean
}>(), {
  memberCount: null,
  canManage: false,
})

const { api } = useApi()
const { fetchSession, patchSessionUser, session } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()
const { getCached, invalidateCached, patchOrgSettingsCache } = useOrgSettingsPageData()

const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const deleting = ref(false)
const deleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const orgName = ref((props.initialName || '').trim())
const iconUrl = ref<string | null>(props.initialIconUrl ?? null)
const iconFailed = ref(false)

const displayName = computed(() => orgName.value || props.orgSlug)
const orgSlugDisplay = computed(() => props.orgSlug.trim() || '—')

const orgInitial = computed(() => {
  const source = displayName.value
  return Array.from(source)[0]?.toUpperCase() || '?'
})

const memberCountLabel = computed(() => {
  if (props.memberCount == null) {
    return '—'
  }
  return `${props.memberCount.toLocaleString('ja-JP')}人`
})

const createdAtLabel = computed(() => {
  const formatted = formatDateDisplay(props.createdAt)
  return formatted || '—'
})

watch(
  () => props.initialName,
  (name, previous) => {
    const next = (name || '').trim()
    const prior = (previous || '').trim()
    if (orgName.value === prior || orgName.value === next) {
      orgName.value = next
    }
  },
)

watch(
  () => props.initialIconUrl,
  (url) => {
    iconUrl.value = url ?? null
    iconFailed.value = false
  },
)

watch(iconUrl, () => {
  iconFailed.value = false
})

function onIconError () {
  iconFailed.value = true
}

function notifyOrgUpdated (payload: { name: string; icon_url: string | null }) {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('tm:org-updated', {
    detail: {
      slug: props.orgSlug,
      name: payload.name,
      icon_url: payload.icon_url,
    },
  }))
}

function patchCachedOrg (payload: { name: string; icon_url: string | null }) {
  const cached = getCached(props.orgSlug)
  if (!cached) return
  patchOrgSettingsCache(props.orgSlug, {
    ...cached.orgSettings,
    name: payload.name,
    icon_url: payload.icon_url,
  })
}

function onOrgSaved (payload: { name: string; icon_url: string | null }) {
  orgName.value = payload.name
  iconUrl.value = payload.icon_url
  iconFailed.value = false
  patchCachedOrg(payload)
  notifyOrgUpdated(payload)
}

function dropDeletedOrganizationFromSession (slug: string) {
  const current = session.value?.user
  if (!current?.organizations) {
    return
  }
  const organizations = current.organizations.filter(org => org.slug !== slug)
  const deleted = current.organizations.find(org => org.slug === slug)
  const lastWasDeleted = deleted != null && current.last_organization_id === deleted.id
  patchSessionUser({
    organizations,
    ...(lastWasDeleted
      ? { last_organization_id: organizations[0]?.id ?? null }
      : {}),
  })
}

async function confirmDeleteOrganization () {
  if (!props.canManage || deleting.value) {
    return
  }
  const slug = props.orgSlug.trim()
  if (!slug) {
    return
  }
  deleting.value = true
  try {
    await api(`/orgs/${slug}`, { method: 'DELETE' })
    invalidateCached(slug)
    invalidateOrgDerivedCaches(slug)
    dropDeletedOrganizationFromSession(slug)
    const fresh = await fetchSession({ force: true })
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:org-deleted', { detail: { slug } }))
    }
    deleteModalOpen.value = false
    const path = await resolvePostLoginPath(fresh.user)
    await navigateTo(path, { replace: true })
  } catch (error: unknown) {
    deleteModalRef.value?.setSubmitError(
      error instanceof Error ? error.message : '組織の削除に失敗しました。',
    )
  } finally {
    deleting.value = false
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsOrganizationPanel.scss"></style>
