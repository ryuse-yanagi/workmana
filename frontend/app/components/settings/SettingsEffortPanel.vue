<template>
  <SettingsPanel title="工数設定" note="タスクの工数入力で使う単位を設定します。">
    <form @submit.prevent="save">
      <label class="settings-field">
        <span>工数単位</span>
        <select v-model="unitDraft" class="settings-input" :disabled="loading">
          <option
            v-for="option in EFFORT_UNIT_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="settings-button-row">
        <button type="submit" class="settings-primary-btn" :disabled="loading">
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
import {
  EFFORT_UNIT_OPTIONS,
  normalizeEffortUnit,
  type TaskFormEffortUnit,
} from '../../composables/useTaskFormHelpers'
import { useOrgEffortSettings } from '../../composables/useOrgEffortSettings'
import SettingsPanel from './SettingsPanel.vue'
import type { OrgSettingsResponse } from './types'

const props = defineProps<{
  orgSlug: string
  initialUnit: TaskFormEffortUnit
}>()

const { api } = useApi()
const { syncEffortSettings } = useOrgEffortSettings()

const unitCurrent = ref<TaskFormEffortUnit>(props.initialUnit)
const unitDraft = ref<TaskFormEffortUnit>(props.initialUnit)
const loading = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

function applyCurrent (unit: TaskFormEffortUnit) {
  unitCurrent.value = unit
  unitDraft.value = unit
  syncEffortSettings(props.orgSlug, { effort_unit: unit })
}

async function load () {
  const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`)
  applyCurrent(normalizeEffortUnit(res.effort_unit))
}

function resetDraft () {
  unitDraft.value = unitCurrent.value
  setMessage('', 'ok')
}

async function save () {
  const unit = normalizeEffortUnit(unitDraft.value)

  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { effort_unit: unit },
    })
    applyCurrent(normalizeEffortUnit(res.effort_unit))
    setMessage('工数設定を更新しました。', 'ok')
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:org-effort-settings-updated', {
        detail: { slug: props.orgSlug },
      }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '工数設定の更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}

defineExpose({ load })
</script>

<style lang="scss">
@use './shared';
</style>
