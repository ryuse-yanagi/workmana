import type { WorkspaceLinkedItem } from '../components/modals/WorkspaceLinkedItemsModal.vue'
import type { OrgWorkspaceItem } from './useOrgWorkspaceIndexPageData'

export function useWorkspaceLinkedItemsNavigation (
  orgSlug: MaybeRefOrGetter<string>,
  workspace: MaybeRefOrGetter<OrgWorkspaceItem | null>,
) {
  const router = useRouter()
  const relatedWorkspacesModalOpen = ref(false)
  const documentsModalOpen = ref(false)

  const relatedWorkspaceItems = computed((): WorkspaceLinkedItem[] => (
    (toValue(workspace)?.related_workspaces ?? []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
  ))

  const documentItems = computed((): WorkspaceLinkedItem[] => (
    (toValue(workspace)?.documents ?? []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
  ))

  function openRelatedWorkspacesList (): void {
    relatedWorkspacesModalOpen.value = true
  }

  function openDocumentsList (): void {
    documentsModalOpen.value = true
  }

  function navigateToRelatedWorkspace (item: WorkspaceLinkedItem): void {
    relatedWorkspacesModalOpen.value = false
    void router.push(`/org/${toValue(orgSlug).trim()}/workspaces/${item.id}`)
  }

  function navigateToDocument (item: WorkspaceLinkedItem): void {
    documentsModalOpen.value = false
    void router.push(`/org/${toValue(orgSlug).trim()}/documents/${item.id}`)
  }

  return {
    relatedWorkspacesModalOpen,
    documentsModalOpen,
    relatedWorkspaceItems,
    documentItems,
    openRelatedWorkspacesList,
    openDocumentsList,
    navigateToRelatedWorkspace,
    navigateToDocument,
  }
}
