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
          v-if="mode === 'table'"
          class="subheader-actions"
        >
          <button
            type="button"
            class="document-header-action-btn document-header-action-btn--display-items"
            :disabled="!tableBoardRef || tableEditSaving"
            @click="onDisplayItemsClick"
          >
            表示項目
          </button>
          <button
            type="button"
            class="document-header-action-btn document-header-action-btn--primary document-header-action-btn--task-add"
            :disabled="!tableBoardRef || tableEditSaving"
            @click="onTaskCreateClick"
          >
            <FilePlus
              :size="16"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            タスク追加
          </button>
          <template v-if="!tableEditMode">
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary document-header-action-btn--edit"
              :disabled="!tableBoardRef || tableEditSaving"
              @click="onStartTableEditClick"
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
              :disabled="tableEditSaving"
              @click="onCancelTableEditClick"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary"
              :disabled="tableEditSaving"
              @click="onConfirmTableEditClick"
            >
              <Check
                :size="16"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              {{ tableEditSaving ? '保存中...' : '完了' }}
            </button>
          </template>
        </div>
      </div>
    </header>
    <section class="workspace-view-page__body">
      <WorkspaceTableBoard
        v-if="mode === 'table' && orgSlug && workspaceId"
        ref="tableBoardRef"
        v-model:edit-mode="tableEditMode"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
        @edit-saving-change="tableEditSaving = $event"
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
import WorkspaceTableBoard from './WorkspaceTableBoard.vue'
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'

const props = defineProps<{
  mode: WorkspaceViewKey
  orgSlug?: string
  workspaceId?: string
}>()

const boardRef = ref<InstanceType<typeof WorkspaceBoard> | null>(null)
const tableBoardRef = ref<InstanceType<typeof WorkspaceTableBoard> | null>(null)
const pageCssVars = useWorkspaceViewPageCssVars()
const tableEditMode = ref(false)
const tableEditSaving = ref(false)

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
    tableEditMode.value = false
    tableEditSaving.value = false
  },
)

/** 子の startEdit がセッション開始まで完了してからヘッダーを切り替える */
function onStartTableEditClick () {
  if (tableEditSaving.value || !tableBoardRef.value) {
    return
  }
  tableEditMode.value = tableBoardRef.value.startEdit()
}

function onCancelTableEditClick () {
  if (tableEditSaving.value) {
    return
  }
  tableBoardRef.value?.cancelEdit?.()
  tableEditMode.value = false
}

function onConfirmTableEditClick () {
  if (tableEditSaving.value) {
    return
  }
  void tableBoardRef.value?.confirmEdit?.()
}

function onTaskCreateClick () {
  if (tableEditSaving.value) {
    return
  }
  tableBoardRef.value?.openTaskCreate?.()
}

function onDisplayItemsClick () {
  if (tableEditSaving.value) {
    return
  }
  tableBoardRef.value?.openDisplayItems?.()
}

function refreshOnViewSwitch (): Promise<void> {
  if (props.mode === 'board') {
    return boardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
  }
  return tableBoardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
}

defineExpose({
  refreshOnViewSwitch,
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceProjectView.scss"></style>
