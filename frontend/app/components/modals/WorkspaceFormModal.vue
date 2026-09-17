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
    <div class="workspace-form-section">
      <TaskFormPane
        ref="formPaneRef"
        v-model="draft"
        :org-slug="orgSlug"
        :org-labels="labels"
        :label-categories="labelCategories"
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
    <ModalFooterActions
      :confirm-text="submitLabel"
      :disabled="loading"
      @cancel="close"
      @confirm="submit"
    />
  </PaneEntityFormModal>
</template>

<script setup lang="ts">
import TaskFormPane from '../task/TaskFormPane.vue'
import PaneEntityFormModal from './PaneEntityFormModal.vue'
import {
  createEmptyTaskFormDraft,
  type TaskFormCategory,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { LabelCategoryGroup } from '../../composables/useLabelCategories'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { workspaceNameFieldError } from '../../utils/formValidation'
import { dismissExclusivePopoverBeforeModalClose } from '../../utils/uiInteraction'

export type WorkspaceFormLabel = TaskFormLabel
export type WorkspaceFormStatus = TaskFormCategory

export type WorkspaceFormInitialValues = {
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
  mode?: 'create' | 'details'
  initialValues?: WorkspaceFormInitialValues | null
  orgSlug: string
  labels: WorkspaceFormLabel[]
  labelCategories?: LabelCategoryGroup[]
  orgMembers: TaskFormMember[]
  statuses?: WorkspaceFormStatus[]
  loading?: boolean
}>(), {
  title: '',
  mode: 'create',
  initialValues: null,
  statuses: () => [],
  labelCategories: () => [],
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

const panePopoverOpen = computed(() => formPaneRef.value?.activePopover != null)

const modalTitle = computed(() => {
  if (props.title) return props.title
  return props.mode === 'details' ? 'スペース詳細' : 'スペースの作成'
})

const submitLabel = computed(() => (
  props.mode === 'details' ? '保存' : '作成'
))

function draftFromInitialValues (values: WorkspaceFormInitialValues | null | undefined): TaskFormDraft {
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
  const validationError = workspaceNameFieldError(draft.value.title)
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
    status: draft.value.status?.name ?? null,
    label_ids: draft.value.labels.map(label => label.id),
    assignee_ids: draft.value.assignees.map(member => member.id),
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

<style lang="scss" scoped src="~/assets/styles/components/modals/WorkspaceFormModal.scss"></style>
