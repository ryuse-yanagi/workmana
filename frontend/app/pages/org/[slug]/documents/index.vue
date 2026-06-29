<template>
  <main
    class="list-page"
    :style="listPageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryInitialLoad" />
    </template>
    <template v-else-if="pageReady">
      <header class="page-header">
        <div class="subheader">
          <p class="subheader-title">Documents</p>
          <div class="subheader-filters">
            <select v-model="sortMode" class="header-sort" aria-label="並び順">
              <option value="newest">ID降順</option>
              <option value="oldest">ID昇順</option>
              <option value="name">名前順</option>
            </select>
            <p class="subheader-count" aria-live="polite">{{ visibleDocuments.length }} 件</p>
            <input
              v-model.trim="searchQuery"
              class="header-search"
              type="search"
              placeholder="資料名で検索"
              aria-label="検索"
            />
          </div>
          <button
            class="primary-btn"
            type="button"
            disabled
          >
            <FolderPlus :size="18" :stroke-width="2.25" aria-hidden="true" />
            新規追加
          </button>
        </div>
      </header>
      <div class="page-shell-fade">
        <section class="documents-body">
          <p class="documents-body__lead">
            詳細な一覧 UI は準備中です。
          </p>
        </section>
      </div>
    </template>
  </main>
</template>
<script setup lang="ts">
import { FolderPlus } from 'lucide-vue-next'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import {
  useOrgDocumentsPageData,
  type OrgDocumentsPageSnapshot,
} from '../../../../composables/useOrgDocumentsPageData'
definePageMeta({
  name: 'org-slug-documents',
  key: route => route.fullPath,
  keepalive: true,
})
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const {
  fetchSnapshot,
  getCached,
  invalidateCached,
} = useOrgDocumentsPageData()
const documents = ref<OrgDocumentsPageSnapshot['documents']>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const globalHeaderOffsetPx = ref(46)
const listPageCssVars = computed(() => ({
  '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
  '--app-shell-page-pad': '0.25rem',
} as Record<string, string>))
const visibleDocuments = computed(() => {
  const query = searchQuery.value.toLowerCase()
  const filtered = query
    ? documents.value.filter(document => document.name.toLowerCase().includes(query))
    : [...documents.value]
  if (sortMode.value === 'name') {
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }
  if (sortMode.value === 'oldest') {
    return filtered.sort((a, b) => a.id - b.id)
  }
  return filtered.sort((a, b) => b.id - a.id)
})
let globalHeaderObserver: ResizeObserver | null = null
function readGlobalHeaderHeight (): number {
  if (!import.meta.client) {
    return 52
  }
  const el = document.querySelector('.global-header') as HTMLElement | null
  if (!el) {
    return 52
  }
  return Math.ceil(el.getBoundingClientRect().height)
}
function updateStickyOffsets () {
  if (!import.meta.client) {
    return
  }
  globalHeaderOffsetPx.value = readGlobalHeaderHeight()
}
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
  } finally {
    if (import.meta.client) {
      await nextTick()
      updateStickyOffsets()
    }
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
  if (!import.meta.client) {
    return
  }
  nextTick(() => {
    updateStickyOffsets()
    const globalHeader = document.querySelector('.global-header') as HTMLElement | null
    if (globalHeader && 'ResizeObserver' in window) {
      globalHeaderObserver = new ResizeObserver(() => {
        updateStickyOffsets()
      })
      globalHeaderObserver.observe(globalHeader)
    }
    window.addEventListener('resize', updateStickyOffsets)
  })
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  window.removeEventListener('resize', updateStickyOffsets)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
})
</script>
<style lang="scss" scoped>
.list-page {
  min-height: calc(100dvh - var(--global-header-offset, 46px));
  padding: 0 1rem 1rem;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  box-sizing: border-box;
}
.page-header {
  position: sticky;
  top: var(--global-header-offset, 46px);
  z-index: 40;
  margin-bottom: 1rem;
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  box-sizing: border-box;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 0.9rem;
  background: #ffffff;
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
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.subheader::-webkit-scrollbar {
  display: none;
}
.subheader-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 900;
  color: #2b2e2f;
  line-height: 1.1;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.subheader-filters {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
}
.header-search,
.header-sort {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0 0.55rem;
  font-size: 0.82rem;
  background: #fff;
  color: #0f172a;
  box-sizing: border-box;
  height: 32px;
  line-height: 32px;
}
.header-search {
  flex: 1;
  min-width: 6rem;
  max-width: 18rem;
}
.header-search::placeholder {
  color: #94a3b8;
}
.header-search:focus,
.header-sort:focus {
  @include mixin.input-focus-ring;
}
.header-sort {
  flex-shrink: 0;
  width: 6.75rem;
  padding-right: 1.5rem;
  cursor: pointer;
}
.subheader-count {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}
.primary-btn {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.4rem 2rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.1em;
  background: mixin.$main-aqua;
  color: mixin.$white;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 0.35rem;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.documents-body {
  max-width: 72rem;
  margin-left: auto;
  margin-right: auto;
}
.documents-body__lead {
  margin: 0;
  font-size: 0.875rem;
  color: mixin.$text-sub;
}
</style>
