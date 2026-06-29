<template>
  <main class="workspace-view-page" :style="pageCssVars">
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryInitialLoad" />
    </template>
    <template v-else-if="pageReady">
      <header class="page-header">
        <div class="subheader">
          <NuxtLink :to="`/org/${slug}/workspaces`" class="subheader-title subheader-back-link">
            ワークスペース一覧
          </NuxtLink>
          <div class="subheader-spacer" />
        </div>
      </header>
      <section class="workspace-view-page__body">
        <h1 class="workspace-view-page__title">共有資料</h1>
        <p class="workspace-view-page__lead">
          {{ documents.length }} 件。詳細な一覧 UI は準備中です。
        </p>
      </section>
    </template>
  </main>
</template>
<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import {
  useOrgDocumentsPageData,
  type OrgDocumentsPageSnapshot,
} from '../../../../composables/useOrgDocumentsPageData'
import { useWorkspaceViewPageCssVars, useWorkspaceViewPageRoot } from '../../../../composables/useWorkspaceViewPageRoot'
definePageMeta({
  name: 'org-slug-documents',
  key: route => route.fullPath,
  keepalive: true,
})
useWorkspaceViewPageRoot()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const pageCssVars = useWorkspaceViewPageCssVars()
const {
  fetchSnapshot,
  getCached,
  invalidateCached,
} = useOrgDocumentsPageData()
const documents = ref<OrgDocumentsPageSnapshot['documents']>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
function applySnapshot (snapshot: OrgDocumentsPageSnapshot) {
  documents.value = snapshot.documents
}
async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  fatalLoadError.value = null
  if (!refresh) {
    const cached = getCached(slug.value)
    if (cached) {
      applySnapshot(cached)
      pageReady.value = true
      return
    }
  } else {
    pageReady.value = false
  }
  try {
    await withAppLoadingCursor(async () => {
      const result = await raceWithTimeout(
        () => fetchSnapshot(slug.value),
        TM_PAGE_LOAD_TIMEOUT_MS,
      )
      if (!result.ok) {
        fatalLoadError.value = result.reason === 'timeout' ? timeoutMessage() : result.message
        return
      }
      applySnapshot(result.value)
      pageReady.value = true
    })
  } catch (e: unknown) {
    fatalLoadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  }
}
function retryInitialLoad () {
  invalidateCached(slug.value)
  pageReady.value = false
  void load({ refresh: true })
}
onBeforeMount(() => {
  const cached = getCached(slug.value)
  if (cached) {
    applySnapshot(cached)
    pageReady.value = true
  }
})
onActivated(() => {
  const cached = getCached(slug.value)
  if (cached) {
    applySnapshot(cached)
    pageReady.value = true
  }
})
onMounted(() => {
  if (!pageReady.value) {
    void load()
  }
})
</script>
<style lang="scss" scoped>
.workspace-view-page {
  box-sizing: border-box;
  height: calc(100dvh - var(--global-header-offset, 46px) - var(--app-shell-page-pad, 0.25rem));
  max-height: calc(100dvh - var(--global-header-offset, 46px) - var(--app-shell-page-pad, 0.25rem));
  padding: 0 1rem;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
  margin-bottom: 0.2rem;
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  box-sizing: border-box;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 1.4rem 0 0.9rem;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.35);
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.18);
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  min-width: 0;
}
.subheader-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 900;
  color: #2b2e2f;
  line-height: 1.1;
  flex-shrink: 0;
}
.subheader-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  text-decoration: none;
  color: mixin.$main-aqua;
  letter-spacing: 0.05em;
  line-height: 1.1;
  transition: color 0.16s ease;
  &::before {
    content: '';
    flex-shrink: 0;
    display: block;
    width: 0.65em;
    height: 0.85em;
    background-color: currentColor;
    -webkit-mask-image: url('~/assets/images/chevron-left.svg');
    mask-image: url('~/assets/images/chevron-left.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
}
.subheader-spacer {
  flex: 1;
  min-width: 0;
}
.workspace-view-page__body {
  flex: 0 0 auto;
  padding: 0.65rem 0 0;
  color: mixin.$text-sub;
}
.workspace-view-page__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}
.workspace-view-page__lead {
  margin: 0;
  font-size: 0.875rem;
}
</style>
