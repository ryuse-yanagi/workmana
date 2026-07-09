<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader />
    <div class="app-shell__page">
      <NuxtPage keepalive />
    </div>
  </div>
</template>
<style lang="scss">
@use '~/assets/styles/text-select';
:root {
  --tm-global-header-height: 56px;
  --tm-page-header-height: 48px;
}
html,
body {
  height: 100%;
}
html {
  line-height: 1.5;
  font-synthesis: none;
  text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
}
body {
  margin: 0;
  font-family: mixin.$font-family;
  font-size: 14px;
  line-height: inherit;
  font-synthesis: inherit;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f6fa;
}
html.workspace-view-page-root,
body.workspace-view-page-root {
  overflow: hidden;
  overscroll-behavior: none;
}
.app-shell {
  min-height: 100%;
}
.app-shell__page {
  padding-top: 3.5px;
}
.global-header,
.page-header,
.workspace-view-switcher-menu {
  @include mixin.header-font;
}
.global-header,
.page-header,
.workspace-view-switcher-menu,
.composer,
.subheader-menu-dropdown,
.list-header-menu-dropdown,
.card-menu,
.archived-tasks-modal__actions {
  a:hover,
  button:hover {
    opacity: 0.8;
  }
}
.settings-button-row--start > .settings-primary-btn[type='button']:hover {
  opacity: 0.8;
}
/*
 * Toast・一覧メニュー用 Teleport などはページ側の都度。
 */
.page-shell-fade {
  width: 100%;
}
/* 初回データ取得前のプレースホルダー（文言は出さない） */
.page-await-spacer {
  min-height: min(42vh, 392px);
  width: 100%;
}
/* 初回読み込み失敗・タイムアウト */
.load-fatal-panel {
  box-sizing: border-box;
  max-width: 504px;
  margin: 28px auto;
  padding: 21px 17.5px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 12px;
  text-align: center;
}
.load-fatal-message {
  margin: 0 0 14px;
  color: #b91c1c;
  font-weight: 700;
  font-size: 13.3px;
}
.load-fatal-retry {
  border: 1px solid #0f172a;
  border-radius: 8px;
  padding: 7px 15.4px;
  font-size: 12.6px;
  font-weight: 700;
  cursor: pointer;
  background: #0f172a;
  color: #fff;
}
.load-fatal-retry:hover {
  opacity: 0.92;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset']):not([type='hidden']),
textarea,
select {
  @include mixin.input-border-default;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset']):not([type='hidden']):focus,
input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset']):not([type='hidden']):focus-visible,
textarea:focus,
textarea:focus-visible,
select:focus,
select:focus-visible {
  @include mixin.input-focus-ring;
}
// チェックボックス風の選択 UI — 保存中などで disabled でも禁止カーソルにしない
button.label-picker-row,
button.parent-task-picker-row,
button.member-picker-row,
button.color-preset-picker__btn {
  @include mixin.picker-checkbox-row;
}
input[type='checkbox']:disabled,
input[type='radio']:disabled {
  cursor: pointer;
}
</style>
