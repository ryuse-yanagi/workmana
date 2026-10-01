<template>
  <div class="project-page-root">
    <p v-if="archiveCheckError" class="project-page-root__error" role="alert">
      {{ archiveCheckError }}
      <button type="button" class="project-page-root__retry" @click="retryArchiveCheck">再試行</button>
    </p>
    <div
      v-else-if="!archiveGateReady"
      class="project-page-root__loading"
      role="status"
      aria-busy="true"
      aria-label="読み込み中"
    >
      <div class="spinner" />
    </div>
    <KeepAlive v-else :max="2">
      <WorkspaceDetailView
        :key="displayedView"
        ref="viewRef"
        v-model:task-search-query="taskSearchQuery"
        v-model:task-filters="taskFilters"
        :mode="displayedView"
        :org-slug="slug"
        :workspace-id="workspaceId"
      />
    </KeepAlive>
  </div>
</template>
<script setup lang="ts">
import WorkspaceDetailView from '../../../../../components/workspace/WorkspaceDetailView.vue'
import {
  getCachedWorkspaceDetailItem,
  prefetchWorkspaceDetail,
  revalidateWorkspaceDetailInBackground,
} from '../../../../../composables/workspace/useWorkspaceDetailMeta'
import { useOrgWorkspaceIndexPageData } from '../../../../../composables/workspace/useOrgWorkspaceIndexPageData'
import { invalidateWorkspaceViewCaches } from '../../../../../composables/settings/invalidateOrgDerivedCaches'
import { useWorkspaceViewRoutes, type WorkspaceViewKey } from '../../../../../composables/workspace/useWorkspaceViewRoutes'
import { useWorkspaceViewPageRoot } from '../../../../../composables/workspace/useWorkspaceViewPageRoot'
import { isAccessDeniedMessage } from '../../../../../utils/shared/resourceAccessError'
import {
  createEmptyWorkspaceTaskFilters,
  type WorkspaceTaskFilters,
} from '../../../../../utils/task/workspaceTaskFilters'
definePageMeta({
  name: 'org-slug-workspaces-id',
  key: route => `${route.params.slug}:${route.params.id}`,
  keepalive: true,
})
useWorkspaceViewPageRoot()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const workspaceId = computed(() => route.params.id as string)
const { removeCachedWorkspace } = useOrgWorkspaceIndexPageData()
const archiveGateReady = ref(false)
const archiveCheckError = ref<string | null>(null)
let revalidateSeq = 0

async function redirectToWorkspaceList (): Promise<void> {
  await navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
}

/** 一覧とボード／WBS のキャッシュを捨ててスペース一覧へ戻す */
async function handleArchivedOrMissingWorkspace (): Promise<void> {
  removeCachedWorkspace(slug.value, Number(workspaceId.value))
  invalidateWorkspaceViewCaches(slug.value, workspaceId.value)
  await redirectToWorkspaceList()
}

function readCachedWorkspace () {
  return getCachedWorkspaceDetailItem(slug.value, workspaceId.value)
}

/** アーカイブ済みと権限なしは、キャッシュを捨ててスペース一覧へ戻す */
async function fetchAndRedirectIfInactive (): Promise<boolean> {
  archiveCheckError.value = null
  try {
    const meta = await prefetchWorkspaceDetail(slug.value, workspaceId.value, { force: true })
    if (meta.workspace.archived_at) {
      await handleArchivedOrMissingWorkspace()
      return true
    }
    return false
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'スペース情報の取得に失敗しました'
    if (isAccessDeniedMessage(message)) {
      await handleArchivedOrMissingWorkspace()
      return true
    }
    archiveCheckError.value = message
    return false
  }
}

function revalidateWorkspaceAccessInBackground (): void {
  const seq = ++revalidateSeq
  void (async () => {
    try {
      const meta = await prefetchWorkspaceDetail(slug.value, workspaceId.value, { force: true })
      if (seq !== revalidateSeq) {
        return
      }
      if (meta.workspace.archived_at) {
        await handleArchivedOrMissingWorkspace()
      }
    } catch (e: unknown) {
      if (seq !== revalidateSeq) {
        return
      }
      const message = e instanceof Error ? e.message : 'スペース情報の取得に失敗しました'
      if (isAccessDeniedMessage(message)) {
        await handleArchivedOrMissingWorkspace()
      }
    }
  })()
}

/** キャッシュが有効なら先に表示して裏で確認し、アーカイブ済みならスペース一覧へ戻す */
async function ensureActiveWorkspaceGate (): Promise<void> {
  archiveCheckError.value = null
  const cached = readCachedWorkspace()

  if (cached?.archived_at) {
    await handleArchivedOrMissingWorkspace()
    return
  }

  if (cached) {
    archiveGateReady.value = true
    revalidateWorkspaceAccessInBackground()
    return
  }

  archiveGateReady.value = false
  const redirected = await fetchAndRedirectIfInactive()
  if (!redirected && !archiveCheckError.value) {
    archiveGateReady.value = true
    revalidateWorkspaceDetailInBackground(slug.value, workspaceId.value)
  }
}

async function retryArchiveCheck () {
  archiveGateReady.value = false
  await ensureActiveWorkspaceGate()
}

onBeforeMount(() => {
  void ensureActiveWorkspaceGate()
})
const { activeView } = useWorkspaceViewRoutes(() => slug.value, () => workspaceId.value)
const viewRef = ref<InstanceType<typeof WorkspaceDetailView> | null>(null)
/** ボード / WBS 切替でも検索語・フィルターを共有（KeepAlive でインスタンスが分かれるため親で保持） */
const taskSearchQuery = ref('')
const taskFilters = ref<WorkspaceTaskFilters>(createEmptyWorkspaceTaskFilters())
function resolveProjectView (view: string): WorkspaceViewKey {
  if (view === 'wbs') {
    return 'wbs'
  }
  return 'board'
}
const displayedView = ref<WorkspaceViewKey>(resolveProjectView(activeView.value))
let viewSwitchSeq = 0
function taskQueryForcesBoard (): boolean {
  return route.query.task != null
    && route.query.task !== ''
    && activeView.value !== 'wbs'
}
function syncViewFromRoute () {
  // タスク deep link はボードで開く。WBS 画面からの通知だけ WBS のまま開く
  if (taskQueryForcesBoard()) {
    displayedView.value = 'board'
    return
  }
  displayedView.value = resolveProjectView(activeView.value)
}
/** 表示は待たず、切替後にバックグラウンドで最新化 */
function refreshActiveViewInBackground () {
  const seq = ++viewSwitchSeq
  void nextTick(() => {
    if (seq !== viewSwitchSeq) {
      return
    }
    void viewRef.value?.refreshOnViewSwitch()
  })
}
watch(activeView, (view) => {
  if (taskQueryForcesBoard()) {
    displayedView.value = 'board'
    refreshActiveViewInBackground()
    return
  }
  if (view !== 'board' && view !== 'wbs') {
    return
  }
  displayedView.value = view
  refreshActiveViewInBackground()
}, { immediate: true })
watch(
  () => route.query.task,
  () => {
    syncViewFromRoute()
  },
)
watch(
  () => [slug.value, workspaceId.value] as const,
  () => {
    syncViewFromRoute()
    void ensureActiveWorkspaceGate()
  },
)
onActivated(() => {
  syncViewFromRoute()
  void ensureActiveWorkspaceGate()
  refreshActiveViewInBackground()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id.scss"></style>
