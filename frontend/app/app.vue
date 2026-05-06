<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader />
    <div class="app-shell__page">
      <NuxtPage />
    </div>
  </div>
</template>

<style>
:root {
  --tm-global-header-height: 52px;
  --tm-page-header-height: 48px;
}

html,
body {
  height: 100%;
}

body {
  margin: 0;
  background: linear-gradient(160deg, #eef2ff 0%, #dbeafe 35%, #f8fafc 100%);
  background-attachment: fixed;
}

.app-shell {
  min-height: 100%;
}

.app-shell__page {
  padding-top: 0.25rem;
}
</style>
