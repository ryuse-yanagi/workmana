<template>
  <div class="app-shell" :class="{ 'app-shell--auth': isAuthRoute }">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader v-if="!isAuthRoute" />
    <div class="app-shell__page" :class="{ 'app-shell__page--auth': isAuthRoute }">
      <NuxtPage :keepalive="{ exclude: ['index', 'login', 'post-login', 'register', 'organizations-new', 'new', 'invite-token', 'unknown-path'] }" />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

/** 招待・組織作成を含むログイン前後ではグローバルヘッダーを出さない */
const isAuthRoute = computed(() => {
  if (route.meta.authShell === true) {
    return true
  }
  const path = route.path
  return path === '/'
    || path === '/login'
    || path === '/register'
    || path === '/post-login'
    || path === '/organizations/new'
    || path === '/invite'
    || path.startsWith('/invite/')
})
</script>

<style lang="scss" src="~/assets/styles/app.scss"></style>
