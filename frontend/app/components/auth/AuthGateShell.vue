<template>
  <main class="auth-gate" :class="{ 'auth-gate--narrow': narrow }">
    <div class="auth-gate__atmosphere" aria-hidden="true">
      <div class="auth-gate__wash" />
      <div class="auth-gate__orb auth-gate__orb--a" />
      <div class="auth-gate__orb auth-gate__orb--b" />
      <div class="auth-gate__grid" />
    </div>

    <div class="auth-gate__stage">
      <header class="auth-gate__brand">
        <p class="auth-gate__mark">業務管理</p>
        <h1 v-if="title" class="auth-gate__title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-gate__lede">{{ subtitle }}</p>
      </header>

      <section class="auth-gate__panel" :aria-busy="busy || undefined">
        <div v-if="busy" class="auth-gate__busy">
          <span class="auth-gate__spinner" aria-hidden="true" />
          <p>{{ busyLabel }}</p>
        </div>
        <slot />
      </section>

      <p v-if="$slots.footer" class="auth-gate__footer">
        <slot name="footer" />
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  busy?: boolean
  busyLabel?: string
  narrow?: boolean
}>(), {
  title: '',
  subtitle: '',
  busy: false,
  busyLabel: '確認しています…',
  narrow: false,
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/auth/AuthGateShell.scss"></style>
<style lang="scss" src="~/assets/styles/pages/auth-gate-form.scss"></style>
