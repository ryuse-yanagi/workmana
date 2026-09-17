import type { RelatedPickerItem } from '../components/modals/RelatedItemPickerModal.vue'
import { syncPeerCachesAfterWorkspaceRelatedWorkspacesChange } from './syncRelatedRelationCaches'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import {
  useOrgWorkspaceIndexCacheRevision,
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceItem,
  type OrgWorkspaceRelatedItem,
} from './useOrgWorkspaceIndexPageData'
import { useWorkspaceMutations } from './useWorkspaceMutations'

export function useWorkspaceRelatedWorkspacesPicker (
  orgSlug: MaybeRefOrGetter<string>,
  workspace: MaybeRefOrGetter<OrgWorkspaceItem | null>,
) {
  const pickerOpen = ref(false)
  const pickerPending = ref(false)
  const pickerRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

  const { getCached, fetchSnapshot } = useOrgWorkspaceIndexPageData()
  const orgWorkspaceIndexRevision = useOrgWorkspaceIndexCacheRevision()
  const workspaceMutations = useWorkspaceMutations(orgSlug)

  const candidateItems = computed((): RelatedPickerItem[] => {
    void orgWorkspaceIndexRevision.value
    const slug = toValue(orgSlug).trim()
    const snapshot = getCached(slug)
    if (!snapshot) {
      return []
    }
    const currentId = toValue(workspace)?.id
    return snapshot.workspaces
      .filter(item => !item.archived_at && item.id !== currentId)
      .map(item => ({
        id: item.id,
        name: item.name,
        description: item.description ?? null,
      }))
  })

  const initialSelectedIds = computed(() => (
    (toValue(workspace)?.related_workspaces ?? []).map(item => item.id)
  ))

  const hiddenIds = computed(() => {
    const id = toValue(workspace)?.id
    return id ? [id] : []
  })

  async function ensureCandidatesLoaded (): Promise<void> {
    const slug = toValue(orgSlug).trim()
    if (!getCached(slug)) {
      await fetchSnapshot(slug).catch(() => null)
    }
  }

  async function openPicker (): Promise<void> {
    await ensureCandidatesLoaded()
    pickerOpen.value = true
  }

  async function onSubmit (workspaceIds: number[]): Promise<void> {
    const target = toValue(workspace)
    if (!target || pickerPending.value) {
      return
    }

    const previous: OrgWorkspaceRelatedItem[] = target.related_workspaces ?? []
    pickerPending.value = true
    try {
      await withAppLoadingCursor(async () => {
        const next = await workspaceMutations.syncRelatedWorkspaces(target.id, workspaceIds)
        syncPeerCachesAfterWorkspaceRelatedWorkspacesChange(
          toValue(orgSlug).trim(),
          {
            id: target.id,
            name: target.name,
            description: target.description ?? null,
          },
          previous,
          next,
        )
        pickerOpen.value = false
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '関連スペースの保存に失敗しました'
      pickerRef.value?.setSubmitError(message)
    } finally {
      pickerPending.value = false
    }
  }

  return {
    relatedWorkspacesPickerOpen: pickerOpen,
    relatedWorkspacesPickerPending: pickerPending,
    relatedWorkspacesPickerRef: pickerRef,
    relatedWorkspaceCandidateItems: candidateItems,
    relatedWorkspaceInitialSelectedIds: initialSelectedIds,
    relatedWorkspaceHiddenIds: hiddenIds,
    openRelatedWorkspacesPicker: openPicker,
    onRelatedWorkspacesPickerSubmit: onSubmit,
  }
}
