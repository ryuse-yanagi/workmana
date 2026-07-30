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
        :aria-label="modalTitle"
      >
        <header class="modal-header">
          <h3>{{ modalTitle }}</h3>
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
              :workspace-statuses="statuses"
              :disabled="loading"
              :title-error="titleError"
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
              :disabled="loading"
              @click="submit"
            >
              {{ submitLabel }}
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
  type TaskFormCategory,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { WORKSPACE_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { workspaceNameFieldError } from '../../utils/formValidation'
import { createOverlayBackdropClose, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'

export type WorkspaceCreateLabel = TaskFormLabel
export type WorkspaceCreateStatus = TaskFormCategory

export type WorkspaceCreateInitialValues = {
  name: string
  description?: string | null
  labels?: TaskFormLabel[]
  assignees?: TaskFormMember[]
  status?: TaskFormCategory | null
}

type FormPaneExpose = {
  resetPaneState: () => void
  focusTitleInput: () => void
  activePopover?: TaskFormPopoverType | null
  closePopover?: () => void | Promise<void>
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  mode?: 'create' | 'edit'
  initialValues?: WorkspaceCreateInitialValues | null
  orgSlug: string
  labels: WorkspaceCreateLabel[]
  orgMembers: TaskFormMember[]
  statuses?: WorkspaceCreateStatus[]
  loading?: boolean
}>(), {
  title: '',
  mode: 'create',
  initialValues: null,
  statuses: () => [],
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{
    name: string
    description: string | null
    status: string | null
    label_ids: number[]
    assignee_ids: number[]
  }]
}>()

const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const submitError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const formPaneRef = ref<FormPaneExpose | null>(null)
const overlayRef = ref<HTMLElement | null>(null)

const panePopoverOpen = computed(() => formPaneRef.value?.activePopover != null)

const modalTitle = computed(() => {
  if (props.title) return props.title
  return props.mode === 'edit' ? 'スペースの編集' : 'スペースの作成'
})

const submitLabel = computed(() => (
  props.mode === 'edit' ? '保存' : '作成'
))

function draftFromInitialValues (values: WorkspaceCreateInitialValues | null | undefined): TaskFormDraft {
  const empty = createEmptyTaskFormDraft()
  if (!values) return empty
  return {
    ...empty,
    title: values.name ?? '',
    description: values.description ?? '',
    labels: values.labels ? [...values.labels] : [],
    assignees: values.assignees ? [...values.assignees] : [],
    status: values.status ?? null,
  }
}

function resetForm () {
  draft.value = draftFromInitialValues(
    props.mode === 'edit' ? props.initialValues : null,
  )
  submitError.value = null
  titleError.value = null
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
  if (props.loading) return
  const name = draft.value.title.trim()
  const validationError = workspaceNameFieldError(draft.value.title)
  if (validationError) {
    titleError.value = validationError
    return
  }
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    titleError.value = `スペース名は${WORKSPACE_NAME_MAX_LENGTH}文字以内で入力してください`
    return
  }
  titleError.value = null
  const description = draft.value.description.trim()
  emit('submit', {
    name,
    description: description === '' ? null : description,
    status: draft.value.status?.name ?? null,
    label_ids: draft.value.labels.map(label => label.id),
    assignee_ids: draft.value.assignees.map(member => member.id),
  })
}

watch(
  () => draft.value.title,
  () => {
    if (titleError.value) {
      titleError.value = null
    }
  },
)
watch(
  () => [props.modelValue, props.mode, props.initialValues] as const,
  ([open]) => {
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

<style lang="scss" scoped src="~/assets/styles/components/modals/WorkspaceCreateModal.scss"></style>
