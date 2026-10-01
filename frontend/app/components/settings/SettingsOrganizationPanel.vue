<template>
  <SettingsPanel title="組織設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="editModalOpen = true"
      >
        <Pencil :size="20" :stroke-width="2.1" aria-hidden="true" />
        組織設定
      </button>
    </template>

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

    <OrganizationSettingsModal
      v-model="editModalOpen"
      :org-slug="orgSlug"
      @saved="onOrgSaved"
    />
  </SettingsPanel>
</template>
<script setup lang="ts">
import { Pencil } from 'lucide-vue-next'
import { useOrgSettingsPageData } from '../../composables/settings/useOrgSettingsPageData'
import { formatDateDisplay } from '../../composables/task/useTaskFormHelpers'
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

const { getCached, patchOrgSettingsCache } = useOrgSettingsPageData()

const editModalOpen = ref(false)
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
  (name) => {
    orgName.value = (name || '').trim()
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
</script>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsOrganizationPanel.scss"></style>
