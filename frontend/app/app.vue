<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader />
    <div class="app-shell__page">
      <NuxtPage keepalive />
    </div>
  </div>
</template>
<style lang="scss" src="~/assets/styles/app.scss"></style>
