<template>
  <div class="app-shell" :class="{ 'app-shell--auth': isAuthRoute }">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader v-if="!isAuthRoute" />
    <div class="app-shell__page" :class="{ 'app-shell__page--auth': isAuthRoute }">
      <NuxtPage keepalive />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const isAuthRoute = computed(() => {
  const path = route.path
  return path === '/login'
    || path === '/register'
    || path === '/post-login'
    || path.startsWith('/invite/')
})
</script>

<style lang="scss" src="~/assets/styles/app.scss"></style>
