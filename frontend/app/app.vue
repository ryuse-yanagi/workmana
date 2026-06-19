<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <AppGlobalHeader />
    <div class="app-shell__page">
      <NuxtPage />
    </div>
  </div>
</template>

<style lang="scss">
@use '~/assets/styles/text-select';

:root {
  --tm-global-header-height: 46px;
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

html.project-view-page-root,
body.project-view-page-root {
  overflow: hidden;
  overscroll-behavior: none;
}

.app-shell {
  min-height: 100%;
}

.app-shell__page {
  padding-top: 0.25rem;
}

/*
 * Toast・一覧メニュー用 Teleport などはページ側の都度。
 */
.page-shell-fade {
  width: 100%;
}

/* 初回データ取得前のプレースホルダー（文言は出さない） */
.page-await-spacer {
  min-height: min(42vh, 28rem);
  width: 100%;
}

/* 初回読み込み失敗・タイムアウト */
.load-fatal-panel {
  box-sizing: border-box;
  max-width: 36rem;
  margin: 2rem auto;
  padding: 1.5rem 1.25rem;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 12px;
  text-align: center;
}

.load-fatal-message {
  margin: 0 0 1rem;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.95rem;
}

.load-fatal-retry {
  border: 1px solid #0f172a;
  border-radius: 8px;
  padding: 0.5rem 1.1rem;
  font-size: 0.9rem;
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
