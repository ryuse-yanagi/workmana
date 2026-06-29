<template>
  <div class="settings-label-panel-content">
    <div class="settings-button-row settings-button-row--start">
      <button type="button" class="settings-primary-btn" @click="modalOpen = true">作成</button>
      <button type="button" class="settings-ghost-btn" :disabled="loading" @click="load">
        再読み込み
      </button>
    </div>
    <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
      {{ message }}
    </p>
    <ul class="settings-label-list">
      <li v-for="item in labels" :key="item.id" class="settings-label-item">
        <span class="settings-label-dot" :style="{ backgroundColor: item.color }" />
        <span class="settings-label-name">{{ item.name }}</span>
      </li>
      <li v-if="!labels.length" class="settings-label-empty">まだタスクラベルはありません。</li>
    </ul>
    <LabelCreateModal
      v-model="modalOpen"
      title="タスクラベルの作成"
      :loading="loading"
      @submit="createLabel"
    />
  </div>
</template>
<script setup lang="ts">
import { useApi } from '../../composables/useApi'
import LabelCreateModal from '../modals/LabelCreateModal.vue'
import type { SettingsLabelItem } from './types'
import { resolveLabelColors, withResolvedLabelColor } from '../../utils/colorPresetResolution'
const props = defineProps<{
  orgSlug: string
  initialLabels: SettingsLabelItem[]
}>()
const { api } = useApi()
const labels = ref<SettingsLabelItem[]>([...props.initialLabels])
const loading = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const modalOpen = ref(false)
function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}
async function load () {
  loading.value = true
  try {
    const res = await api<{ data: SettingsLabelItem[] }>(`/orgs/${props.orgSlug}/task-labels`)
    labels.value = resolveLabelColors(res.data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'タスクラベル取得に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
async function createLabel (payload: { name: string; color_index: number }) {
  const name = payload.name.trim()
  if (!name) return
  loading.value = true
  setMessage('', 'ok')
  try {
    const created = await api<SettingsLabelItem>(`/orgs/${props.orgSlug}/task-labels`, {
      method: 'POST',
      body: {
        name,
        color_index: payload.color_index,
      },
    })
    labels.value = [...labels.value, withResolvedLabelColor(created)].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    modalOpen.value = false
    setMessage('タスクラベルを作成しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'タスクラベル作成に失敗しました'
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
