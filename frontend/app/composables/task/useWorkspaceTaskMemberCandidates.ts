import type { TaskFormMember } from './useTaskFormHelpers'
import { useWorkspaceDetailMeta } from '../workspace/useWorkspaceDetailMeta'

/**
 * タスク担当者候補リスト。
 * 正本は workspace.assignees（組織インデックスキャッシュ）。
 * メタ未ロード時のみボード／WBS スナップショットにフォールバックする。
 */
export function useWorkspaceTaskMemberCandidates (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
  snapshotMembers: Ref<TaskFormMember[]>,
) {
  const { workspace } = useWorkspaceDetailMeta(orgSlug, workspaceId)

  const workspaceMembers = computed<TaskFormMember[]>(() => {
    const assignees = workspace.value?.assignees
    if (assignees !== undefined) {
      return assignees
    }
    return snapshotMembers.value
  })

  return {
    workspaceMembers,
    workspace,
  }
}
