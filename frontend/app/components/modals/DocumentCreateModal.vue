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
          <div class="document-form-section">
            <TaskFormPane
              ref="formPaneRef"
              v-model="draft"
              :org-slug="orgSlug"
              :org-labels="labels"
              :document-categories="categories"
              :workspace-members="[]"
              :disabled="loading"
              :title-error="titleError"
              document-mode
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
} from '../../composables/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { DOCUMENT_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { documentNameFieldError } from '../../utils/formValidation'
import { createOverlayBackdropClose, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'

export type DocumentCreateLabel = TaskFormLabel
export type DocumentCreateCategory = TaskFormCategory

export type DocumentCreateInitialValues = {
  name: string
  description?: string | null
  category?: TaskFormCategory | null
  labels?: TaskFormLabel[]
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
  initialValues?: DocumentCreateInitialValues | null
  orgSlug: string
  labels: DocumentCreateLabel[]
  categories: DocumentCreateCategory[]
  loading?: boolean
}>(), {
  title: '',
  mode: 'create',
  initialValues: null,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{
    name: string
    description: string | null
    category: string | null
    label_ids: number[]
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
  return props.mode === 'edit' ? '資料の編集' : '資料の作成'
})

const submitLabel = computed(() => (
  props.mode === 'edit' ? '保存' : '作成'
))

function draftFromInitialValues (values: DocumentCreateInitialValues | null | undefined): TaskFormDraft {
  const empty = createEmptyTaskFormDraft()
  if (!values) return empty
  return {
    ...empty,
    title: values.name ?? '',
    description: values.description ?? '',
    category: values.category ?? null,
    labels: values.labels ? [...values.labels] : [],
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
  const validationError = documentNameFieldError(draft.value.title)
  if (validationError) {
    titleError.value = validationError
    return
  }
  if (name.length > DOCUMENT_NAME_MAX_LENGTH) {
    titleError.value = `資料名は${DOCUMENT_NAME_MAX_LENGTH}文字以内で入力してください`
    return
  }
  titleError.value = null
  const description = draft.value.description.trim()
  emit('submit', {
    name,
    description: description === '' ? null : description,
    category: draft.value.category?.name ?? null,
    label_ids: draft.value.labels.map(label => label.id),
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

<style lang="scss" scoped src="~/assets/styles/components/modals/DocumentCreateModal.scss"></style>
