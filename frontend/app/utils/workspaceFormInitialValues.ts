import type { WorkspaceFormInitialValues } from '../components/modals/WorkspaceFormModal.vue'

/** スペース詳細メタ → WorkspaceFormModal 初期値 */
export function toWorkspaceFormInitialValues (target: {
  name: string
  description?: string | null
  labels?: WorkspaceFormInitialValues['labels']
  assignees?: WorkspaceFormInitialValues['assignees']
  status?: { name: string; color?: string | null } | null
} | null | undefined): WorkspaceFormInitialValues | null {
  if (!target) {
    return null
  }
  const status = target.status
    ? {
        name: target.status.name,
        color: target.status.color ?? '',
      }
    : null
  return {
    name: target.name,
    description: target.description ?? null,
    labels: target.labels ?? [],
    assignees: target.assignees ?? [],
    status,
  }
}
