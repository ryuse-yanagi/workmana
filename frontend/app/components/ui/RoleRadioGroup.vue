<template>
  <fieldset class="role-radio-group" :disabled="disabled">
    <legend class="role-radio-group__legend">{{ legend }}</legend>
    <ul
      class="role-radio-group__list"
      role="radiogroup"
      :aria-label="legend"
    >
      <li
        v-for="option in options"
        :key="option.value"
        class="role-radio-group__item"
      >
        <button
          type="button"
          class="role-radio-group__option"
          :class="{ 'role-radio-group__option--checked': modelValue === option.value }"
          role="radio"
          :aria-checked="modelValue === option.value"
          :disabled="disabled"
          @click="emit('update:modelValue', option.value)"
        >
          <input
            type="radio"
            class="role-radio-group__radio"
            :name="name"
            :checked="modelValue === option.value"
            tabindex="-1"
            aria-hidden="true"
          >
          <span class="role-radio-group__label">{{ option.label }}</span>
        </button>
      </li>
    </ul>
  </fieldset>
</template>

<script setup lang="ts">
export type OrgMemberRole = 'admin' | 'member'

export type RoleRadioOption = {
  value: OrgMemberRole
  label: string
}

const DEFAULT_OPTIONS: RoleRadioOption[] = [
  { value: 'member', label: '一般ユーザー' },
  { value: 'admin', label: '管理者' },
]

withDefaults(defineProps<{
  modelValue: OrgMemberRole
  legend?: string
  name?: string
  disabled?: boolean
  options?: RoleRadioOption[]
}>(), {
  legend: 'ロール',
  name: 'org-member-role',
  disabled: false,
  options: () => DEFAULT_OPTIONS,
})

const emit = defineEmits<{
  'update:modelValue': [OrgMemberRole]
}>()
</script>

<style lang="scss" scoped src="~/assets/styles/components/ui/RoleRadioGroup.scss"></style>
