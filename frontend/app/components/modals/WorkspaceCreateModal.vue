<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="overlayRef"
      class="modal-overlay"
      :class="{ 'modal-overlay--popover-open': panePopoverOpen }"
      role="presentation"
      @mousedown="onOverlayMouseDown"
    >
      <section
        class="modal-card"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button
            type="button"
            class="icon-close"
            :disabled="loading"
            aria-label="閉じる"
            @click="close"
          >✕</button>
        </header>
        <div class="modal-body">
          <div class="workspace-form-section">
            <TaskFormPane
              ref="formPaneRef"
              v-model="draft"
              :org-slug="orgSlug"
              :org-labels="labels"
              :workspace-members="orgMembers"
              :disabled="loading"
              workspace-mode
              relaxed-title-padding
              auto-focus-title
            />
          </div>
          <p v-if="submitError" class="err">{{ submitError }}</p>
          <footer class="modal-footer">
            <button
              type="button"
              class="ghost-btn"
              :disabled="loading"
              @click="close"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="primary-btn"
              :disabled="!canSubmit"
              @click="submit"
            >
              {{ loading ? '作成中...' : '登録' }}
            </button>
          </footer>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import TaskFormPane from '../task/TaskFormPane.vue'
import {
  createEmptyTaskFormDraft,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { WORKSPACE_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { createOverlayBackdropClose, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'

export type WorkspaceCreateLabel = TaskFormLabel

type FormPaneExpose = {
  resetPaneState: () => void
  focusTitleInput: () => void
  activePopover?: TaskFormPopoverType | null
  closePopover?: () => void | Promise<void>
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  orgSlug: string
  labels: WorkspaceCreateLabel[]
  orgMembers: TaskFormMember[]
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{
    name: string
    description: string | null
    label_ids: number[]
    assignee_ids: number[]
  }]
}>()

const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const submitError = ref<string | null>(null)
const formPaneRef = ref<FormPaneExpose | null>(null)
const overlayRef = ref<HTMLElement | null>(null)

const panePopoverOpen = computed(() => formPaneRef.value?.activePopover != null)

const canSubmit = computed(() => {
  const name = draft.value.title.trim()
  return name.length >= 2 && name.length <= WORKSPACE_NAME_MAX_LENGTH && !props.loading
})

function resetForm () {
  draft.value = createEmptyTaskFormDraft()
  submitError.value = null
  nextTick(() => {
    formPaneRef.value?.resetPaneState()
  })
}

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function onBackdropClose () {
  if (props.loading) return
  if (panePopoverOpen.value) {
    void formPaneRef.value?.closePopover?.()
    return
  }
  close()
}

function onDocumentKeydown (event: KeyboardEvent) {
  if (!props.modelValue) return
  if (getTopmostModalOverlay() !== overlayRef.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onBackdropClose()
    return
  }
  if (isCtrlEnterKeydown(event)) {
    if (!canSubmit.value) return
    event.preventDefault()
    event.stopPropagation()
    submit()
  }
}

const {
  onOverlayMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: onBackdropClose,
  canClose: () => !props.loading,
})

function submit () {
  if (!canSubmit.value) return
  const name = draft.value.title.trim()
  const description = draft.value.description.trim()
  emit('submit', {
    name,
    description: description === '' ? null : description,
    label_ids: draft.value.labels.map(label => label.id),
    assignee_ids: draft.value.assignees.map(member => member.id),
  })
}

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    if (open) {
      document.addEventListener('keydown', onDocumentKeydown, true)
      resetForm()
      return
    }
    document.removeEventListener('keydown', onDocumentKeydown, true)
    resetOverlayBackdropClose()
    void formPaneRef.value?.closePopover?.()
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
})
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 56px 14px 14px;
  z-index: 70;
  overflow-y: auto;
}
.modal-overlay--popover-open {
  overflow: hidden;
}
.modal-card {
  position: relative;
  width: min(560px, 100%);
  border-radius: 12px;
  overflow: visible;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
.modal-header {
  @include mixin.modal-header-bar;
  border-radius: 12px 12px 0 0;
}
.modal-header h3 {
  margin: 0;
  font-size: 14.7px;
  line-height: 1;
}
.icon-close {
  @include mixin.modal-close-hit-area;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 19.6px;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  position: relative;
  padding: 16.8px 18.9px 18.9px;
  display: flex;
  flex-direction: column;
  gap: 15.4px;
  overflow: visible;
  border-radius: 0 0 12px 12px;
}
.workspace-form-section {
  overflow: visible;
  min-width: 0;
}
.modal-footer {
  display: flex;
  justify-content: center;
  gap: 7px;
  padding-top: 3.5px;
}
.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 7px 15.4px;
  font-weight: 800;
  cursor: pointer;
  font-size: 16px;
}
.primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}
.ghost-btn {
  border-color: #cbd5e1;
  color: mixin.$text-sub;
  background: #f1f5f9;
}
.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 12.04px;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
