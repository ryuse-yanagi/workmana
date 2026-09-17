import type { WorkspaceLinkedItem } from '../components/modals/WorkspaceLinkedItemsModal.vue'
import type { OrgWorkspaceItem } from './useOrgWorkspaceIndexPageData'

export function useWorkspaceDocumentsListNavigation (
  orgSlug: MaybeRefOrGetter<string>,
  workspace: MaybeRefOrGetter<OrgWorkspaceItem | null>,
) {
  const router = useRouter()
  const documentsModalOpen = ref(false)

  const documentItems = computed((): WorkspaceLinkedItem[] => (
    (toValue(workspace)?.documents ?? []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
  ))

  function openDocumentsList (): void {
    documentsModalOpen.value = true
  }

  function navigateToDocument (item: WorkspaceLinkedItem): void {
    documentsModalOpen.value = false
    void router.push(`/org/${toValue(orgSlug).trim()}/documents/${item.id}`)
  }

  return {
    documentsModalOpen,
    documentItems,
    openDocumentsList,
    navigateToDocument,
  }
}
