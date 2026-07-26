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
          <template v-if="!tableEditMode">
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary document-header-action-btn--edit"
              :disabled="!tableBoardRef"
              @click="tableBoardRef?.startEdit()"
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
              @click="tableBoardRef?.cancelEdit()"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--primary"
              :disabled="tableEditSaving"
              @click="tableBoardRef?.confirmEdit()"
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
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
        @edit-mode-change="tableEditMode = $event"
        @edit-saving-change="tableEditSaving = $event"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import { Check, Pencil } from 'lucide-vue-next'
import type { WorkspaceViewKey } from '../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageCssVars } from '../../composables/useWorkspaceViewPageRoot'
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

watch(
  () => props.mode,
  () => {
    tableEditMode.value = false
    tableEditSaving.value = false
  },
)

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
<style lang="scss" scoped>
.workspace-project-view {
  box-sizing: border-box;
  height: calc(100dvh - var(--global-header-offset, 56px) - var(--app-shell-page-pad, 3.5px));
  max-height: calc(100dvh - var(--global-header-offset, 56px) - var(--app-shell-page-pad, 3.5px));
  padding: 0 14px;
  margin-top: calc(-1 * var(--app-shell-page-pad, 3.5px));
  padding-top: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
  width: calc(100% + 28px);
  margin-left: -14px;
  margin-right: -14px;
  @include mixin.page-header-shell;
  padding: 0 19.6px 0 12.6px;
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  min-width: 0;
}
.subheader-title {
  @include mixin.page-header-title;
}
.subheader-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4.2px;
  padding: 8px 0;
  margin: -8px 0;
  text-decoration: none;
  color: mixin.$main;
  letter-spacing: 0.05em;
  line-height: 1.1;
  transition: opacity 0.16s ease;
  &::before {
    content: '';
    flex-shrink: 0;
    display: block;
    width: 0.65em;
    height: 0.85em;
    background-color: currentColor;
    -webkit-mask-image: url('~/assets/images/chevron-left.svg');
    mask-image: url('~/assets/images/chevron-left.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
}
.subheader-spacer {
  flex: 1;
  min-width: 0;
}
.subheader-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.document-header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  margin: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid mixin.$main;
  border-radius: 6px;
  background: #fff;
  color: mixin.$main;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  :deep(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}
.document-header-action-btn:not(.document-header-action-btn--muted):not(.document-header-action-btn--edit) {
  width: 96px;
}
.document-header-action-btn--edit {
  min-width: 96px;
}
.document-header-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.document-header-action-btn:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-header-action-btn--muted {
  border-color: transparent;
  background: #e5e7eb;
  color: #475569;
}
.document-header-action-btn--primary {
  background: mixin.$main;
  color: #fff;
}
.workspace-view-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 0 10.5px;
}
.workspace-view-page__body > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
