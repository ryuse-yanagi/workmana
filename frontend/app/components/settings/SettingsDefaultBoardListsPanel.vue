<template>
  <SettingsPanel
    title="デフォルトリスト設定"
    note="プロジェクト新規作成時に自動で作成するリストの名前を設定します。上から順に左側の列として並びます。"
  >
    <form class="default-lists-form" @submit.prevent="save">
      <ul class="default-lists-editor">
        <li
          v-for="(_name, index) in namesDraft"
          :key="`default-list-${index}`"
          class="default-lists-row"
        >
          <label class="settings-field default-lists-field">
            <span>リスト {{ index + 1 }}</span>
            <input
              v-model.trim="namesDraft[index]"
              class="settings-input"
              type="text"
              maxlength="255"
              placeholder="リスト名を入力してください"
            />
          </label>
          <button
            type="button"
            class="settings-ghost-btn default-lists-remove-btn"
            :disabled="loading"
            aria-label="リストを削除"
            @click="removeRow(index)"
          >
            削除
          </button>
        </li>
      </ul>

      <div class="settings-button-row settings-button-row--start">
        <button
          type="button"
          class="settings-ghost-btn"
          :disabled="loading || namesDraft.length >= 20"
          @click="addRow"
        >
          リストを追加
        </button>
      </div>

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
import SettingsPanel from './SettingsPanel.vue'
import {
  normalizeDefaultBoardListNames,
  serializeDefaultBoardListNames,
  type OrgSettingsResponse,
} from './types'

const props = defineProps<{
  orgSlug: string
}>()

const { api } = useApi()

const namesCurrent = ref<string[]>([])
const namesDraft = ref<string[]>([])
const loading = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

async function load () {
  const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`)
  const names = normalizeDefaultBoardListNames(res.default_board_list_names)
  namesCurrent.value = [...names]
  namesDraft.value = [...names]
}

function resetDraft () {
  namesDraft.value = [...namesCurrent.value]
  setMessage('', 'ok')
}

function addRow () {
  if (namesDraft.value.length >= 20) return
  namesDraft.value = [...namesDraft.value, '']
}

function removeRow (index: number) {
  namesDraft.value = namesDraft.value.filter((_, i) => i !== index)
}

async function save () {
  const names = serializeDefaultBoardListNames(namesDraft.value)
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { default_board_list_names: names },
    })
    const savedNames = normalizeDefaultBoardListNames(res.default_board_list_names)
    namesCurrent.value = [...savedNames]
    namesDraft.value = [...savedNames]
    setMessage('デフォルトリスト設定を更新しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'デフォルトリスト設定の更新に失敗しました'
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

<style lang="scss" scoped>
.default-lists-form {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.default-lists-editor {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.default-lists-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.default-lists-field {
  flex: 1;
  min-width: 0;
}

.default-lists-remove-btn {
  flex-shrink: 0;
  margin-bottom: 0.1rem;
}
</style>
