<template>
  <BaseModal
    :model-value="modelValue"
    title="組織の削除"
    aria-label="組織の削除"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(480px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <div class="org-delete-modal-body">
      <p class="org-delete-modal-message">
        この組織を削除します。よろしいですか？
        <template v-if="expectedName">
          <span class="org-delete-modal-target">【対象】<br>{{ expectedName }}</span>
        </template>
        <br>※組織内のデータがすべて削除されます。この操作は元に戻せません。
      </p>
      <div class="org-delete-confirm">
        <label class="org-delete-confirm__label" for="org-delete-name">
          確認のため、組織名を入力してください。
        </label>
        <input
          id="org-delete-name"
          v-model="typedName"
          class="org-delete-confirm__input"
          type="text"
          autocomplete="off"
          placeholder="組織名を入力"
          :maxlength="ORGANIZATION_NAME_MAX_LENGTH"
          :disabled="loading"
        />
      </div>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        confirm-text="削除"
        confirm-variant="danger"
        :disabled="loading"
        :confirm-disabled="!nameMatches"
        :confirm-muted="!nameMatches"
        @cancel="close"
        @confirm="submit"
      />
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { ORGANIZATION_NAME_MAX_LENGTH } from '../../../constants/fieldLengthLimits'
import { syncAppLoadingCursor } from '../../../composables/ui/useAppLoadingCursor'
import BaseModal from '../shared/BaseModal.vue'
import ModalFooterActions from '../shared/ModalFooterActions.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  organizationName?: string
  loading?: boolean
}>(), {
  organizationName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
const submitError = ref<string | null>(null)
const typedName = ref('')
/** 開いた時点の組織名。削除中に親の名称が消えても確認対象がずれないようにする */
const expectedName = ref('')
const nameMatches = computed(() => typedName.value === expectedName.value)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      submitError.value = null
      typedName.value = ''
      expectedName.value = props.organizationName ?? ''
    }
  },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading || !nameMatches.value) return
  submitError.value = null
  emit('confirm')
}
function setSubmitError (message: string) {
  submitError.value = message
}

syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/settings/OrganizationDeleteModal.scss"></style>
