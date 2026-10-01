import type { ArchivedNamedItemsResource } from '../composables/archived/useArchivedNamedItemsCache'

export const queryKeys = {
  orgWorkspaceIndex: (slug: string) => ['orgWorkspaceIndex', slug.trim()] as const,
  orgWorkspaceItem: (slug: string, workspaceId: string | number) =>
    ['orgWorkspaceItem', slug.trim(), String(workspaceId).trim()] as const,
  workspaceBoard: (slug: string, workspaceId: string) =>
    ['workspaceBoard', slug.trim(), workspaceId.trim()] as const,
  workspaceWbs: (slug: string, workspaceId: string) =>
    ['workspaceWbs', slug.trim(), workspaceId.trim()] as const,
  orgSettings: (slug: string) => ['orgSettings', slug.trim()] as const,
  orgSettingsPage: (slug: string) => ['orgSettingsPage', slug.trim()] as const,
  orgDocuments: (slug: string) => ['orgDocuments', slug.trim()] as const,
  orgDocument: (slug: string, documentId: string | number) =>
    ['orgDocument', slug.trim(), String(documentId)] as const,
  archivedTasks: (slug: string, workspaceId: string | number) =>
    ['archivedTasks', slug.trim(), String(workspaceId).trim()] as const,
  archivedNamedItems: (
    slug: string,
    resource: ArchivedNamedItemsResource,
    workspaceId?: string | number | null,
  ) => {
    const trimmedSlug = slug.trim()
    if (resource === 'documents' && workspaceId != null && workspaceId !== '') {
      return ['archivedNamedItems', resource, trimmedSlug, String(workspaceId).trim()] as const
    }
    return ['archivedNamedItems', resource, trimmedSlug] as const
  },
} as const
