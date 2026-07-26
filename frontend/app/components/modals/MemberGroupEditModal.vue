<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle"
    :aria-label="modalTitle"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(512px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="member-group-edit-modal-body" @keydown="onFormKeydown">
      <label class="field">
        <span>グループ名</span>
        <input
          v-model.trim="name"
          type="text"
          :maxlength="MEMBER_GROUP_NAME_MAX_LENGTH"
          required
          placeholder="グループ名を入力してください"
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </label>

      <div class="field field--members">
        <span>メンバー</span>
        <div class="member-picker-row">
          <div v-if="selectedMembers.length" class="member-avatar-list">
            <MemberAvatar
              v-for="member in selectedMembers"
              :key="member.id"
              :member="member"
              size="sm"
              :title="memberDisplayName(member)"
              :aria-label="memberDisplayName(member)"
              :decorative="false"
            />
          </div>
          <button
            ref="memberButtonRef"
            type="button"
            class="member-add-btn"
            :class="{ 'member-add-btn--active': memberPickerOpen }"
            :disabled="loading"
            aria-label="メンバーを選択"
            @click="toggleMemberPicker"
          >
            <UserPlus :size="16" :stroke-width="2.25" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ColorPresetPicker
        v-model="color"
        :presets="STANDARD_COLORS"
        :grid-columns="5"
        :disabled="loading"
      />
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading" @click="submit">
          {{ submitLabel }}
        </button>
      </div>
    </form>

    <Teleport to="body">
      <WorkspaceMemberPickerPopover
        v-if="memberPickerOpen"
        ref="memberPickerRef"
        :assignees="selectedMembers"
        :org-members="orgMembers"
        :search-query="memberSearchQuery"
        :disabled="loading"
        :style="memberPickerStyle"
        title="メンバー"
        assigned-section-heading="メンバー"
        unassigned-section-heading="ユーザー"
        empty-members-message="組織ユーザーがいません。"
        @close="closeMemberPicker"
        @toggle-member="toggleMember"
        @update:search-query="memberSearchQuery = $event"
      />
    </Teleport>
  </BaseModal>
</template>

<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import ColorPresetPicker from '../ui/ColorPresetPicker.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import WorkspaceMemberPickerPopover from '../workspace/WorkspaceMemberPickerPopover.vue'
import {
  DEFAULT_STANDARD_COLOR,
  STANDARD_COLORS,
  standardColorAtIndex,
  standardColorIndexFromHex,
} from '../../constants/colorPresets'
import { MEMBER_GROUP_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { requiredTextFieldError } from '../../utils/formValidation'

export type MemberGroupEditPayload = {
  name: string
  color_index: number
  member_ids: number[]
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  mode?: 'create' | 'edit'
  orgMembers: TaskFormMember[]
  initialValues?: {
    name: string
    color_index: number
    members: TaskFormMember[]
  } | null
  loading?: boolean
}>(), {
  mode: 'create',
  initialValues: null,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [MemberGroupEditPayload]
}>()

const name = ref('')
const color = ref<string>(DEFAULT_STANDARD_COLOR)
const selectedMembers = ref<TaskFormMember[]>([])
const submitError = ref<string | null>(null)
const nameError = ref<string | null>(null)
const memberPickerOpen = ref(false)
const memberSearchQuery = ref('')
const memberButtonRef = ref<HTMLElement | null>(null)
const memberPickerRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const memberPickerStyle = ref<Record<string, string>>({})

const modalTitle = computed(() => (
  props.mode === 'edit' ? 'グループの編集' : 'グループの作成'
))
const submitLabel = computed(() => (
  props.mode === 'edit' ? '保存' : '作成'
))

watch(
  () => [props.modelValue, props.mode, props.initialValues] as const,
  ([open]) => {
    if (!open) {
      closeMemberPicker()
      return
    }
    if (props.mode === 'edit' && props.initialValues) {
      name.value = props.initialValues.name
      color.value = standardColorAtIndex(props.initialValues.color_index)
      selectedMembers.value = [...props.initialValues.members]
    } else {
      name.value = ''
      color.value = props.initialValues
        ? standardColorAtIndex(props.initialValues.color_index)
        : DEFAULT_STANDARD_COLOR
      selectedMembers.value = props.initialValues
        ? [...props.initialValues.members]
        : []
    }
    submitError.value = null
    nameError.value = null
    memberSearchQuery.value = ''
  },
)

watch(name, () => {
  if (nameError.value) {
    nameError.value = null
  }
})

function close () {
  if (props.loading) return
  closeMemberPicker()
  emit('update:modelValue', false)
}

function submit () {
  if (props.loading) return
  const validationError = requiredTextFieldError(name.value, 'グループ名を入力してください')
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  submitError.value = null
  closeMemberPicker()
  emit('submit', {
    name: trimmed,
    color_index: standardColorIndexFromHex(color.value),
    member_ids: selectedMembers.value.map(member => member.id),
  })
}

function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}

function toggleMember (member: TaskFormMember) {
  const index = selectedMembers.value.findIndex(item => item.id === member.id)
  if (index >= 0) {
    selectedMembers.value = selectedMembers.value.filter(item => item.id !== member.id)
    return
  }
  selectedMembers.value = [...selectedMembers.value, member]
}

function closeMemberPicker () {
  memberPickerOpen.value = false
  memberSearchQuery.value = ''
}

function positionMemberPicker () {
  const anchor = memberButtonRef.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const gap = 8
  const width = Math.min(273, window.innerWidth - 21)
  let left = rect.left
  if (left + width > window.innerWidth - 10.5) {
    left = Math.max(10.5, window.innerWidth - width - 10.5)
  }
  let top = rect.bottom + gap
  const estimatedHeight = 320
  if (top + estimatedHeight > window.innerHeight - 10.5) {
    top = Math.max(10.5, rect.top - estimatedHeight - gap)
  }
  memberPickerStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${Math.min(360, window.innerHeight - top - 10.5)}px`,
  }
}

function toggleMemberPicker () {
  if (props.loading) return
  if (memberPickerOpen.value) {
    closeMemberPicker()
    return
  }
  positionMemberPicker()
  memberPickerOpen.value = true
}

function onDocumentPointerDown (event: PointerEvent) {
  if (!memberPickerOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (memberButtonRef.value?.contains(target)) return
  if (memberPickerRef.value?.rootRef?.contains(target)) return
  closeMemberPicker()
}

function onDocumentKeydown (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !memberPickerOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMemberPicker()
}

function setSubmitError (message: string) {
  submitError.value = message
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
  window.addEventListener('resize', closeMemberPicker)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
  window.removeEventListener('resize', closeMemberPicker)
})

defineExpose({ setSubmitError })
</script>

<style lang="scss" scoped>
.member-group-edit-modal-body {
  padding: 14px 18.9px 18.9px;
  display: flex;
  flex-direction: column;
  gap: 11.9px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
  color: #0f172a;
  font-weight: 800;
  font-size: 12.32px;
}
.field input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 8.68px 10.5px;
  font-size: 12.6px;
  font-weight: 400;
  color: #0f172a;
  background: #fff;
  line-height: 1.35;
  &:focus {
    @include mixin.input-focus-ring;
  }
}
.field-error {
  margin: 0;
  color: mixin.$danger;
  font-weight: 700;
  font-size: 12.04px;
}
.member-picker-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.member-avatar-list {
  display: flex;
  align-items: center;
  gap: 4.2px;
  flex-wrap: wrap;
}
.member-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px dashed #cbd5e1;
  border-radius: 999px;
  background: #f8fafc;
  color: #475569;
  cursor: pointer;
}
.member-add-btn--active {
  border-style: solid;
  border-color: mixin.$main;
  color: mixin.$main;
  background: #fff;
  box-shadow: 0 0 0 2px color-mix(in srgb, mixin.$main 15%, transparent);
}
.member-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.err {
  margin: 0;
  color: mixin.$danger;
  font-weight: 700;
  font-size: 12.04px;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 7px;
  padding-top: 3.5px;
}
.ghost-btn,
.primary-btn {
  @include mixin.btn-base;
}
.ghost-btn--pill,
.primary-btn--pill {
  @include mixin.btn-pill;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.primary-btn {
  @include mixin.btn-primary;
}
</style>
