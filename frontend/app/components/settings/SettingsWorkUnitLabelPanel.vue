<template>
  <SettingsPanel title="work_unit_label設定" note="この組織で使う名称（例: プロジェクト / 部署）を設定します。">
    <form @submit.prevent="save">
      <label class="settings-field">
        <span>表示名</span>
        <input
          v-model.trim="labelDraft"
          class="settings-input"
          type="text"
          maxlength="40"
          required
          placeholder="例: プロジェクト"
        />
      </label>
      <div class="settings-button-row">
        <button type="submit" class="settings-primary-btn" :disabled="loading || !labelDraft">
          {{ loading ? '保存中...' : '更新' }}
        </button>
        <button type="button" class="settings-ghost-btn" :disabled="loading" @click="resetDraft">
          元に戻す
        </button>
      </div>
      <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
        {{ message }}
      </p>
    </form>
  </SettingsPanel>
</template>

<script setup lang="ts">
import { useApi } from '../../composables/useApi'
import { useOrgTerminology } from '../../composables/useOrgTerminology'
import SettingsPanel from './SettingsPanel.vue'
import type { OrgSettingsResponse } from './types'

const props = defineProps<{
  orgSlug: string
}>()

const { api } = useApi()
const { syncLabelState, DEFAULT_WORK_UNIT_LABEL } = useOrgTerminology()

const labelCurrent = ref(DEFAULT_WORK_UNIT_LABEL)
const labelDraft = ref(DEFAULT_WORK_UNIT_LABEL)
const loading = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

async function load () {
  const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`)
  const label = (res.work_unit_label || '').trim() || DEFAULT_WORK_UNIT_LABEL
  syncLabelState(props.orgSlug, label)
  labelCurrent.value = label
  labelDraft.value = label
}

function resetDraft () {
  labelDraft.value = labelCurrent.value
  setMessage('', 'ok')
}

async function save () {
  const label = labelDraft.value.trim()
  if (!label) return
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { work_unit_label: label },
    })
    const savedLabel = (res.work_unit_label || '').trim() || DEFAULT_WORK_UNIT_LABEL
    labelCurrent.value = savedLabel
    labelDraft.value = savedLabel
    syncLabelState(props.orgSlug, savedLabel)
    setMessage('work_unit_label を更新しました。', 'ok')
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:org-work-unit-label-updated', { detail: { slug: props.orgSlug } }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'work_unit_label の更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}

defineExpose({ load })

onMounted(() => {
  void load()
})
</script>

<style lang="scss">
@use './shared';
</style>
