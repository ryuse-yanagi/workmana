<template>
  <PaneEntityFormModal
    :model-value="modelValue"
    :title="modalTitle"
    :loading="loading"
    :popover-open="panePopoverOpen"
    @update:model-value="emit('update:modelValue', $event)"
    @backdrop-close="onBackdropClose"
    @ctrl-enter="submit"
  >
    <div class="document-form-section">
      <TaskFormPane
        ref="formPaneRef"
        v-model="draft"
        :org-slug="orgSlug"
        :org-labels="[]"
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
    <ModalFooterActions
      :confirm-text="submitLabel"
      :disabled="loading"
      @cancel="close"
      @confirm="submit"
    />
  </PaneEntityFormModal>
</template>

<script setup lang="ts">
import TaskFormPane from '../../task/TaskFormPane.vue'
import PaneEntityFormModal from '../shared/PaneEntityFormModal.vue'
import {
  createEmptyTaskFormDraft,
  type TaskFormCategory,
  type TaskFormDraft,
} from '../../../composables/task/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../../composables/task/useTaskFormPane'
import { documentNameFieldError } from '../../../utils/shared/formValidation'
import { dismissExclusivePopoverBeforeModalClose } from '../../../utils/ui/uiInteraction'

export type DocumentFormCategory = TaskFormCategory

export type DocumentFormInitialValues = {
  name: string
  description?: string | null
  category?: TaskFormCategory | null
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
  mode?: 'add' | 'details'
  initialValues?: DocumentFormInitialValues | null
  orgSlug: string
  categories: DocumentFormCategory[]
  loading?: boolean
}>(), {
  title: '',
  mode: 'add',
  initialValues: null,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{
    name: string
    description: string | null
    category: string | null
  }]
}>()

const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const submitError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const formPaneRef = ref<FormPaneExpose | null>(null)

const panePopoverOpen = computed(() => formPaneRef.value?.activePopover != null)

const modalTitle = computed(() => {
  if (props.title) return props.title
  return props.mode === 'details' ? '資料詳細' : '資料の追加'
})

const submitLabel = computed(() => (
  props.mode === 'details' ? '保存' : '追加'
))

function draftFromInitialValues (values: DocumentFormInitialValues | null | undefined): TaskFormDraft {
  const empty = createEmptyTaskFormDraft()
  if (!values) return empty
  return {
    ...empty,
    title: values.name ?? '',
    description: values.description ?? '',
    category: values.category ?? null,
  }
}

function resetForm () {
  draft.value = draftFromInitialValues(
    props.mode === 'details' ? props.initialValues : null,
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
  if (dismissExclusivePopoverBeforeModalClose()) return
  if (panePopoverOpen.value) {
    void formPaneRef.value?.closePopover?.()
    return
  }
  close()
}

function submit () {
  if (props.loading) return
  const name = draft.value.title.trim()
  const validationError = documentNameFieldError(draft.value.title)
  if (validationError) {
    titleError.value = validationError
    return
  }
  titleError.value = null
  submitError.value = null
  const description = draft.value.description.trim()
  emit('submit', {
    name,
    description: description === '' ? null : description,
    category: draft.value.category?.name ?? null,
  })
}

function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })

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
      resetForm()
      return
    }
    void formPaneRef.value?.closePopover?.()
  },
)
</script>

<style lang="scss" scoped src="~/assets/styles/components/modals/document/DocumentFormModal.scss"></style>
