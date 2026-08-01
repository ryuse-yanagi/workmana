<template>
  <WorkspaceBoard
    v-if="mode === 'board'"
    ref="boardRef"
  />
  <div
    v-else
    class="workspace-project-view workspace-view-page"
    :class="`workspace-view-page--${mode}`"
    :style="pageCssVars"
  >
    <header class="page-header">
      <div class="subheader">
        <NuxtLink
          v-if="orgSlug && workspaceId"
          :to="`/org/${orgSlug}/workspaces`"
          class="subheader-title subheader-back-link"
        >
          Workspaces
        </NuxtLink>
        <p
          v-if="workspaceMetaName"
          class="subheader-workspace-name"
        >{{ workspaceMetaName }}</p>
        <WorkspaceViewSwitcher
          v-if="orgSlug && workspaceId"
          :org-slug="orgSlug"
          :workspace-id="workspaceId"
        />
        <div class="subheader-spacer" />
        <div
          v-if="mode === 'wbs'"
          class="subheader-actions"
        >
          <button
            type="button"
            class="document-header-action-btn document-header-action-btn--display-items"
            :disabled="!wbsBoardRef || wbsEditSaving"
            @click="onDisplayItemsClick"
          >
            表示項目
          </button>
          <button
            type="button"
            class="document-header-action-btn document-header-action-btn--primary document-header-action-btn--task-add"
            :disabled="!wbsBoardRef || wbsEditSaving"
            @click="onTaskCreateClick"
          >
            <FilePlus
              :size="16"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            タスク追加
          </button>
          <template v-if="!wbsEditMode">
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary document-header-action-btn--edit"
              :disabled="!wbsBoardRef || wbsEditSaving"
              @click="onStartWbsEditClick"
            >
              <Pencil
                :size="16"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              編集
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--muted"
              :disabled="wbsEditSaving"
              @click="onCancelWbsEditClick"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary"
              :disabled="wbsEditSaving"
              @click="onConfirmWbsEditClick"
            >
              <Check
                :size="16"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              {{ wbsEditSaving ? '保存中...' : '完了' }}
            </button>
          </template>
        </div>
      </div>
    </header>
    <section class="workspace-view-page__body">
      <WorkspaceWbsView
        v-if="mode === 'wbs' && orgSlug && workspaceId"
        ref="wbsBoardRef"
        v-model:edit-mode="wbsEditMode"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
        @edit-saving-change="wbsEditSaving = $event"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import { Check, FilePlus, Pencil } from 'lucide-vue-next'
import type { WorkspaceViewKey } from '../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageCssVars } from '../../composables/useWorkspaceViewPageRoot'
import { useWorkspaceDetailMeta } from '../../composables/useWorkspaceDetailMeta'
import WorkspaceBoard from './WorkspaceBoard.vue'
import WorkspaceWbsView from './WorkspaceWbsView.vue'
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'

const props = defineProps<{
  mode: WorkspaceViewKey
  orgSlug?: string
  workspaceId?: string
}>()

const boardRef = ref<InstanceType<typeof WorkspaceBoard> | null>(null)
const wbsBoardRef = ref<InstanceType<typeof WorkspaceWbsView> | null>(null)
const pageCssVars = useWorkspaceViewPageCssVars()
const wbsEditMode = ref(false)
const wbsEditSaving = ref(false)

const metaSlug = computed(() => props.orgSlug ?? '')
const metaWorkspaceId = computed(() => props.workspaceId ?? '')
const { workspace: workspaceMeta, ensureLoaded } = useWorkspaceDetailMeta(metaSlug, metaWorkspaceId)
const workspaceMetaName = computed(() => workspaceMeta.value?.name ?? '')

watch(
  () => [metaSlug.value, metaWorkspaceId.value] as const,
  ([slug, id]) => {
    if (slug && id) {
      void ensureLoaded()
    }
  },
  { immediate: true },
)
watch(
  () => props.mode,
  () => {
    wbsEditMode.value = false
    wbsEditSaving.value = false
  },
)

/** 子の startEdit がセッション開始まで完了してからヘッダーを切り替える */
function onStartWbsEditClick () {
  if (wbsEditSaving.value || !wbsBoardRef.value) {
    return
  }
  wbsEditMode.value = wbsBoardRef.value.startEdit()
}

function onCancelWbsEditClick () {
  if (wbsEditSaving.value) {
    return
  }
  wbsBoardRef.value?.cancelEdit?.()
  wbsEditMode.value = false
}

function onConfirmWbsEditClick () {
  if (wbsEditSaving.value) {
    return
  }
  void wbsBoardRef.value?.confirmEdit?.()
}

function onTaskCreateClick () {
  if (wbsEditSaving.value) {
    return
  }
  wbsBoardRef.value?.openTaskCreate?.()
}

function onDisplayItemsClick () {
  if (wbsEditSaving.value) {
    return
  }
  wbsBoardRef.value?.openDisplayItems?.()
}

function refreshOnViewSwitch (): Promise<void> {
  if (props.mode === 'board') {
    return boardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
  }
  return wbsBoardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
}

defineExpose({
  refreshOnViewSwitch,
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceProjectView.scss"></style>
