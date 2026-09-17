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
      <WorkspaceProjectView
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
import WorkspaceProjectView from '../../../../../components/workspace/WorkspaceProjectView.vue'
import {
  getCachedWorkspaceDetailItem,
  prefetchWorkspaceDetail,
  revalidateWorkspaceDetailInBackground,
} from '../../../../../composables/useWorkspaceDetailMeta'
import { useOrgWorkspaceIndexPageData } from '../../../../../composables/useOrgWorkspaceIndexPageData'
import { invalidateWorkspaceViewCaches } from '../../../../../composables/invalidateOrgDerivedCaches'
import { useWorkspaceViewRoutes, type WorkspaceViewKey } from '../../../../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageRoot } from '../../../../../composables/useWorkspaceViewPageRoot'
import { isAccessDeniedMessage } from '../../../../../utils/resourceAccessError'
import {
  createEmptyWorkspaceTaskFilters,
  type WorkspaceTaskFilters,
} from '../../../../../utils/workspaceTaskFilters'
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

async function handleArchivedOrMissingWorkspace (): Promise<void> {
  removeCachedWorkspace(slug.value, Number(workspaceId.value))
  invalidateWorkspaceViewCaches(slug.value, workspaceId.value)
  await redirectToWorkspaceList()
}

function readCachedWorkspace () {
  return getCachedWorkspaceDetailItem(slug.value, workspaceId.value)
}

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
const viewRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
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
function syncViewFromRoute () {
  // タスク deep link がある場合はボードで詳細モーダルを開く
  if (route.query.task != null && route.query.task !== '') {
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
  if (route.query.task != null && route.query.task !== '') {
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
