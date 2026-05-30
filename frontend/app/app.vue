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

.app-shell {
  min-height: 100%;
}

.app-shell__page {
  padding-top: 0.25rem;
}

/*
 * .tm-fade-* はページ内のデータ表示・モーダルなどで利用:
 *
 * データ取得完了後のフェード（opacity 0.32s）。
 *
 * 初回ゲート後の本文フェード（ページ別ヘッダーはフェード対象外で常時表示）:
 *   <header class="page-header">…</header>
 *   <Transition name="tm-fade" appear>
 *     <div key="…" class="page-shell-fade"> … 本文 … </div>
 *   </Transition>
 * モーダル本体は各 *Modal.vue 内で <Transition name="tm-fade">（開閉フェード）。
 * Toast・一覧メニュー用 Teleport などはページ側の都度。
 *
 * 一覧と本文で別トランジションが必要な場合は inner に追加の <Transition name="tm-fade"> を使う。
 */
.tm-fade-enter-active,
.tm-fade-leave-active {
  transition: opacity 0.32s ease;
}

.tm-fade-enter-from,
.tm-fade-leave-to {
  opacity: 0;
}

/* ページ別ヘッダー＋本文ラッパー（幅だけ確保。レイアウトは各ページの子要素に任せる） */
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
</style>
