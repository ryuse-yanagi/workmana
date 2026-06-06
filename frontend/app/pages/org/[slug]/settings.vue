<template>
  <main class="settings-page" :class="{ 'settings-page--await': !settingsPageReady && !settingsFatalError }">
    <template v-if="settingsFatalError">
      <PageLoadFatal :message="settingsFatalError" @retry="retrySettingsLoad" />
    </template>

    <template v-else>
      <header class="settings-header">
        <h1>設定</h1>
        <p class="subtitle">左のメニューから変更したい設定を選択してください。</p>
      </header>

      <div v-if="!settingsPageReady" class="page-await-spacer" aria-busy="true" />

      <Transition v-else name="tm-fade" appear>
        <div key="settings-body" class="settings-main page-shell-fade">
          <section class="settings-layout">
      <aside class="settings-sidebar">
        <button
          v-for="item in menuItems"
          :key="item.key"
          type="button"
          class="menu-item"
          :class="{ 'menu-item--active': activeTab === item.key }"
          @click="selectTab(item.key)"
        >
          <span>{{ item.label }}</span>
          <span class="menu-arrow">›</span>
        </button>
      </aside>

      <section class="settings-content">
        <article v-if="activeTab === 'profile'" class="panel">
          <h2>プロフィール設定</h2>
          <p class="panel-note">ユーザー名とアイコン画像を設定できます。</p>

          <form class="profile-name-form" @submit.prevent="saveProfileName">
            <label class="field">
              <span>ユーザー名</span>
              <input
                v-model.trim="profileNameDraft"
                type="text"
                maxlength="255"
                required
                placeholder="表示名を入力"
              />
            </label>
            <div class="button-row">
              <button type="submit" class="primary-btn" :disabled="profileNameLoading || !profileNameDraft">
                {{ profileNameLoading ? '保存中...' : 'ユーザー名を保存' }}
              </button>
              <button type="button" class="ghost-btn" :disabled="profileNameLoading" @click="resetProfileNameDraft">
                元に戻す
              </button>
            </div>
          </form>

          <div class="profile-row">
            <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="ユーザーアイコン" class="avatar-image" />
            <div v-else class="avatar-placeholder">No Icon</div>

            <div class="profile-actions">
              <input type="file" accept="image/*" @change="onAvatarFileChange" />
              <div class="button-row">
                <button type="button" class="primary-btn" :disabled="avatarLoading || !selectedAvatarFile" @click="uploadAvatar">
                  {{ avatarLoading ? '保存中...' : 'アイコンを保存' }}
                </button>
                <button type="button" class="ghost-btn" :disabled="avatarLoading || !avatarPreviewUrl" @click="deleteAvatar">
                  削除
                </button>
              </div>
              <p v-if="profileMessage" class="msg" :class="{ err: profileMessageKind === 'err' }">
                {{ profileMessage }}
              </p>
            </div>
          </div>
        </article>

        <article v-else-if="activeTab === 'work_unit_label'" class="panel">
          <h2>work_unit_label設定</h2>
          <p class="panel-note">この組織で使う名称（例: プロジェクト / 部署）を設定します。</p>

          <form class="label-form" @submit.prevent="saveWorkUnitLabel">
            <label class="field">
              <span>表示名</span>
              <input
                v-model.trim="workUnitLabelDraft"
                type="text"
                maxlength="40"
                required
                placeholder="例: プロジェクト"
              />
            </label>
            <div class="button-row">
              <button type="submit" class="primary-btn" :disabled="labelLoading || !workUnitLabelDraft">
                {{ labelLoading ? '保存中...' : '更新' }}
              </button>
              <button type="button" class="ghost-btn" :disabled="labelLoading" @click="resetLabelDraft">
                元に戻す
              </button>
            </div>
            <p v-if="labelMessage" class="msg" :class="{ err: labelMessageKind === 'err' }">
              {{ labelMessage }}
            </p>
          </form>
        </article>

        <article v-else-if="activeTab === 'project_labels'" class="panel">
          <h2>プロジェクトラベル設定</h2>
          <p class="panel-note">プロジェクトで使うラベルを作成します。</p>
          <div class="button-row button-row--start">
            <button type="button" class="primary-btn" @click="projectLabelModalOpen = true">作成</button>
            <button type="button" class="ghost-btn" :disabled="projectLabelsLoading" @click="loadProjectLabels">
              再読み込み
            </button>
          </div>

          <p v-if="projectLabelsMessage" class="msg" :class="{ err: projectLabelsMessageKind === 'err' }">
            {{ projectLabelsMessage }}
          </p>

          <ul class="label-list">
            <li v-for="item in projectLabels" :key="item.id" class="label-item">
              <span class="label-dot" :style="{ backgroundColor: item.color }" />
              <span class="label-name">{{ item.name }}</span>
            </li>
            <li v-if="!projectLabels.length" class="label-empty">まだプロジェクトラベルはありません。</li>
          </ul>
        </article>

        <article v-else class="panel">
          <h2>タスクラベル設定</h2>
          <p class="panel-note">タスクで使うラベルを作成します。</p>
          <div class="button-row button-row--start">
            <button type="button" class="primary-btn" @click="taskLabelModalOpen = true">作成</button>
            <button type="button" class="ghost-btn" :disabled="taskLabelsLoading" @click="loadTaskLabels">
              再読み込み
            </button>
          </div>

          <p v-if="taskLabelsMessage" class="msg" :class="{ err: taskLabelsMessageKind === 'err' }">
            {{ taskLabelsMessage }}
          </p>

          <ul class="label-list">
            <li v-for="item in taskLabels" :key="item.id" class="label-item">
              <span class="label-dot" :style="{ backgroundColor: item.color }" />
              <span class="label-name">{{ item.name }}</span>
            </li>
            <li v-if="!taskLabels.length" class="label-empty">まだタスクラベルはありません。</li>
          </ul>
        </article>
          </section>
        </section>
        </div>
      </Transition>

    <LabelCreateModal
      v-if="settingsPageReady"
      v-model="projectLabelModalOpen"
      title="プロジェクトラベルの作成"
      :loading="projectLabelsLoading"
      @submit="createProjectLabel"
    />

    <LabelCreateModal
      v-if="settingsPageReady"
      v-model="taskLabelModalOpen"
      title="タスクラベルの作成"
      :loading="taskLabelsLoading"
      @submit="createTaskLabel"
    />
    </template>
  </main>
</template>

<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../composables/raceWithTimeout'
import { useApi } from '../../../composables/useApi'
import { useOrgTerminology } from '../../../composables/useOrgTerminology'

definePageMeta({ name: 'org-slug-settings' })

type TabKey = 'profile' | 'work_unit_label' | 'project_labels' | 'task_labels'
type MeResponse = {
  name?: string | null
  avatar_url?: string | null
}
type WorkUnitSettingsResponse = {
  work_unit_label?: string | null
}
type LabelItem = {
  id: number
  name: string
  color: string
}

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()
const { fetchWorkUnitLabel, syncLabelState, DEFAULT_WORK_UNIT_LABEL } = useOrgTerminology()

const menuItems: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'プロフィール設定' },
  { key: 'work_unit_label', label: 'work_unit_label設定' },
  { key: 'project_labels', label: 'プロジェクトラベル設定' },
  { key: 'task_labels', label: 'タスクラベル設定' },
]

const activeTab = ref<TabKey>('profile')
/** 初回データ取得成功までメイン UI を出さない */
const settingsPageReady = ref(false)
const settingsFatalError = ref<string | null>(null)

const avatarPreviewUrl = ref<string | null>(null)
const selectedAvatarFile = ref<File | null>(null)
const avatarLoading = ref(false)
const profileNameCurrent = ref('')
const profileNameDraft = ref('')
const profileNameLoading = ref(false)
const profileMessage = ref('')
const profileMessageKind = ref<'ok' | 'err'>('ok')

const workUnitLabelCurrent = ref(DEFAULT_WORK_UNIT_LABEL)
const workUnitLabelDraft = ref(DEFAULT_WORK_UNIT_LABEL)
const labelLoading = ref(false)
const labelMessage = ref('')
const labelMessageKind = ref<'ok' | 'err'>('ok')
const projectLabels = ref<LabelItem[]>([])
const projectLabelsLoading = ref(false)
const projectLabelsMessage = ref('')
const projectLabelsMessageKind = ref<'ok' | 'err'>('ok')
const projectLabelModalOpen = ref(false)

const taskLabels = ref<LabelItem[]>([])
const taskLabelsLoading = ref(false)
const taskLabelsMessage = ref('')
const taskLabelsMessageKind = ref<'ok' | 'err'>('ok')
const taskLabelModalOpen = ref(false)

function setProfileMessage (msg: string, kind: 'ok' | 'err') {
  profileMessage.value = msg
  profileMessageKind.value = kind
}

function setLabelMessage (msg: string, kind: 'ok' | 'err') {
  labelMessage.value = msg
  labelMessageKind.value = kind
}

function setProjectLabelsMessage (msg: string, kind: 'ok' | 'err') {
  projectLabelsMessage.value = msg
  projectLabelsMessageKind.value = kind
}

function setTaskLabelsMessage (msg: string, kind: 'ok' | 'err') {
  taskLabelsMessage.value = msg
  taskLabelsMessageKind.value = kind
}

async function loadInitialData () {
  profileMessage.value = ''
  labelMessage.value = ''
  settingsFatalError.value = null

  const r = await raceWithTimeout(async () => {
    const [me, label, projectLabelsRes, taskLabelsRes] = await Promise.all([
      api<MeResponse>('/me'),
      fetchWorkUnitLabel(slug.value),
      api<{ data: LabelItem[] }>(`/orgs/${slug.value}/project-labels`),
      api<{ data: LabelItem[] }>(`/orgs/${slug.value}/task-labels`),
    ])
    profileNameCurrent.value = (me.name || '').trim()
    profileNameDraft.value = profileNameCurrent.value
    avatarPreviewUrl.value = me.avatar_url || null
    syncLabelState(slug.value, label)
    workUnitLabelCurrent.value = label
    workUnitLabelDraft.value = label
    projectLabels.value = projectLabelsRes.data
    taskLabels.value = taskLabelsRes.data
  }, TM_PAGE_LOAD_TIMEOUT_MS)

  if (!r.ok) {
    settingsFatalError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
    return
  }
  settingsPageReady.value = true
}

function retrySettingsLoad () {
  settingsFatalError.value = null
  void loadInitialData()
}

function resetProfileNameDraft () {
  profileNameDraft.value = profileNameCurrent.value
  setProfileMessage('', 'ok')
}

async function saveProfileName () {
  const name = profileNameDraft.value.trim()
  if (!name) return
  profileNameLoading.value = true
  setProfileMessage('', 'ok')
  try {
    const res = await api<{ name?: string | null }>('/me', {
      method: 'PATCH',
      body: { name },
    })
    const savedName = (res.name || '').trim()
    profileNameCurrent.value = savedName
    profileNameDraft.value = savedName
    setProfileMessage('ユーザー名を更新しました。', 'ok')
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:user-profile-updated', { detail: { name: savedName } }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ユーザー名の更新に失敗しました'
    setProfileMessage(msg, 'err')
  } finally {
    profileNameLoading.value = false
  }
}

function onAvatarFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedAvatarFile.value = file
  if (file) {
    avatarPreviewUrl.value = URL.createObjectURL(file)
    setProfileMessage('画像を選択しました。保存を押してください。', 'ok')
  }
}

async function uploadAvatar () {
  if (!selectedAvatarFile.value) return
  avatarLoading.value = true
  setProfileMessage('', 'ok')
  try {
    const body = new FormData()
    body.append('avatar', selectedAvatarFile.value)
    const res = await api<{ avatar_url: string | null }>('/me/avatar', {
      method: 'POST',
      body,
    })
    avatarPreviewUrl.value = res.avatar_url
    selectedAvatarFile.value = null
    setProfileMessage('アイコンを更新しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン更新に失敗しました'
    setProfileMessage(msg, 'err')
  } finally {
    avatarLoading.value = false
  }
}

async function deleteAvatar () {
  avatarLoading.value = true
  setProfileMessage('', 'ok')
  try {
    await api('/me/avatar', { method: 'DELETE' })
    avatarPreviewUrl.value = null
    selectedAvatarFile.value = null
    setProfileMessage('アイコンを削除しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン削除に失敗しました'
    setProfileMessage(msg, 'err')
  } finally {
    avatarLoading.value = false
  }
}

function resetLabelDraft () {
  workUnitLabelDraft.value = workUnitLabelCurrent.value
  setLabelMessage('', 'ok')
}

async function saveWorkUnitLabel () {
  const label = workUnitLabelDraft.value.trim()
  if (!label) return
  labelLoading.value = true
  setLabelMessage('', 'ok')
  try {
    const res = await api<WorkUnitSettingsResponse>(`/orgs/${slug.value}/settings`, {
      method: 'PATCH',
      body: { work_unit_label: label },
    })
    const savedLabel = (res.work_unit_label || '').trim() || DEFAULT_WORK_UNIT_LABEL
    workUnitLabelCurrent.value = savedLabel
    workUnitLabelDraft.value = savedLabel
    syncLabelState(slug.value, savedLabel)
    setLabelMessage('work_unit_label を更新しました。', 'ok')
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:org-work-unit-label-updated', { detail: { slug: slug.value } }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'work_unit_label の更新に失敗しました'
    setLabelMessage(msg, 'err')
  } finally {
    labelLoading.value = false
  }
}

async function loadProjectLabels () {
  projectLabelsLoading.value = true
  try {
    const res = await api<{ data: LabelItem[] }>(`/orgs/${slug.value}/project-labels`)
    projectLabels.value = res.data
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'プロジェクトラベル取得に失敗しました'
    setProjectLabelsMessage(msg, 'err')
  } finally {
    projectLabelsLoading.value = false
  }
}

async function createProjectLabel (payload: { name: string; color: string }) {
  const name = payload.name.trim()
  if (!name) return
  projectLabelsLoading.value = true
  setProjectLabelsMessage('', 'ok')
  try {
    const created = await api<LabelItem>(`/orgs/${slug.value}/project-labels`, {
      method: 'POST',
      body: {
        name,
        color: payload.color,
      },
    })
    projectLabels.value = [...projectLabels.value, created].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    projectLabelModalOpen.value = false
    setProjectLabelsMessage('プロジェクトラベルを作成しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'プロジェクトラベル作成に失敗しました'
    setProjectLabelsMessage(msg, 'err')
  } finally {
    projectLabelsLoading.value = false
  }
}

async function loadTaskLabels () {
  taskLabelsLoading.value = true
  try {
    const res = await api<{ data: LabelItem[] }>(`/orgs/${slug.value}/task-labels`)
    taskLabels.value = res.data
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'タスクラベル取得に失敗しました'
    setTaskLabelsMessage(msg, 'err')
  } finally {
    taskLabelsLoading.value = false
  }
}

async function createTaskLabel (payload: { name: string; color: string }) {
  const name = payload.name.trim()
  if (!name) return
  taskLabelsLoading.value = true
  setTaskLabelsMessage('', 'ok')
  try {
    const created = await api<LabelItem>(`/orgs/${slug.value}/task-labels`, {
      method: 'POST',
      body: {
        name,
        color: payload.color,
      },
    })
    taskLabels.value = [...taskLabels.value, created].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    taskLabelModalOpen.value = false
    setTaskLabelsMessage('タスクラベルを作成しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'タスクラベル作成に失敗しました'
    setTaskLabelsMessage(msg, 'err')
  } finally {
    taskLabelsLoading.value = false
  }
}

function applyTabFromRoute () {
  const raw = route.query.tab
  const tab = typeof raw === 'string' ? raw.trim() : ''
  if (tab === 'work_unit_label') {
    activeTab.value = 'work_unit_label'
    return
  }
  if (tab === 'project_labels') {
    activeTab.value = 'project_labels'
    return
  }
  if (tab === 'task_labels') {
    activeTab.value = 'task_labels'
    return
  }
  activeTab.value = 'profile'
}

function selectTab (tab: TabKey) {
  activeTab.value = tab
  if (tab === 'profile') {
    void router.replace({ path: route.path, query: { tab: 'profile' } })
    return
  }
  if (tab === 'project_labels') {
    void router.replace({ path: route.path, query: { tab: 'project_labels' } })
    return
  }
  if (tab === 'task_labels') {
    void router.replace({ path: route.path, query: { tab: 'task_labels' } })
    return
  }
  void router.replace({ path: route.path, query: { tab: 'work_unit_label' } })
}

onMounted(() => {
  applyTabFromRoute()
  void loadInitialData()
})

watch(
  () => route.query.tab,
  () => {
    applyTabFromRoute()
  },
)
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  padding: 1.25rem 1rem 2rem;
  font-family: system-ui, sans-serif;
}

.settings-header,
.settings-layout {
  max-width: 76rem;
  margin: 0 auto;
}

h1 {
  margin: 0.7rem 0 0.3rem;
  font-size: 1.7rem;
  color: #0f172a;
}

.subtitle {
  margin: 0 0 0.9rem;
  color: #475569;
}

.settings-layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: 1rem;
  align-items: start;
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.menu-item {
  border: 1px solid #dbe3ee;
  background: #fff;
  border-radius: 9px;
  padding: 0.8rem 0.9rem;
  text-align: left;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f2945;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.menu-item--active {
  border-color: mixin.$main;
  box-shadow: 0 0 0 2px color-mix(in srgb, mixin.$main 15%, transparent);
}

.menu-arrow {
  color: #94a3b8;
  font-size: 1.1rem;
}

.settings-content {
  min-height: 22rem;
}

.panel {
  background: #fff;
  border: 1px solid #dbe3ee;
  border-radius: 10px;
  padding: 1rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

.panel-note {
  margin: 0 0 1rem;
  color: #64748b;
}

.profile-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
}

.profile-name-form {
  max-width: 34rem;
}

.avatar-image,
.avatar-placeholder {
  width: 84px;
  height: 84px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
}

.avatar-image { object-fit: cover; background: #fff; }

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f8fafc;
  font-size: 0.8rem;
}

.profile-actions {
  flex: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 700;
}

input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
  background: #fff;
}

.button-row {
  margin-top: 0.55rem;
  display: flex;
  gap: 0.5rem;
}

.button-row--start {
  justify-content: flex-start;
}

.primary-btn,
.ghost-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}

.ghost-btn {
  background: #fff;
  color: #334155;
  border-color: #94a3b8;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.msg {
  margin: 0.55rem 0 0;
  color: #0f766e;
  font-weight: 700;
}

.msg.err {
  color: #b91c1c;
}

.label-list {
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.label-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0.3rem 0.55rem;
  background: #fff;
}

.label-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.label-name {
  font-size: 0.85rem;
  color: #0f172a;
  font-weight: 600;
}

.label-empty {
  color: #64748b;
  font-size: 0.9rem;
}

@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
