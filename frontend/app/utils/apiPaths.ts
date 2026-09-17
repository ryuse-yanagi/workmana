/**
 * 組織 / ワークスペース配下の API パス組み立て。
 * 文字列テンプレートの重複を避け、パス変更時の修正箇所を一箇所に集約する。
 */

type PathId = string | number

export function orgApiPath (orgSlug: string): string {
  return `/orgs/${orgSlug}`
}

export function orgMembersApiPath (orgSlug: string): string {
  return `${orgApiPath(orgSlug)}/members`
}

export function orgMemberApiPath (orgSlug: string, memberId: PathId): string {
  return `${orgMembersApiPath(orgSlug)}/${memberId}`
}

export function orgInvitesApiPath (orgSlug: string): string {
  return `${orgApiPath(orgSlug)}/invites`
}

export function orgInviteApiPath (orgSlug: string, inviteId: PathId): string {
  return `${orgInvitesApiPath(orgSlug)}/${inviteId}`
}

export function orgSettingsApiPath (orgSlug: string): string {
  return `${orgApiPath(orgSlug)}/settings`
}

export function workspaceApiPath (orgSlug: string, workspaceId: PathId): string {
  return `${orgApiPath(orgSlug)}/workspaces/${workspaceId}`
}

export function workspaceListsApiPath (orgSlug: string, workspaceId: PathId): string {
  return `${workspaceApiPath(orgSlug, workspaceId)}/lists`
}

export function workspaceListApiPath (
  orgSlug: string,
  workspaceId: PathId,
  listId: PathId,
): string {
  return `${workspaceListsApiPath(orgSlug, workspaceId)}/${listId}`
}

export function workspaceTasksApiPath (orgSlug: string, workspaceId: PathId): string {
  return `${workspaceApiPath(orgSlug, workspaceId)}/tasks`
}

export function taskApiPath (
  orgSlug: string,
  workspaceId: PathId,
  taskId: PathId,
): string {
  return `${workspaceTasksApiPath(orgSlug, workspaceId)}/${taskId}`
}

export function taskParentsApiPath (orgSlug: string, workspaceId: PathId): string {
  return `${workspaceTasksApiPath(orgSlug, workspaceId)}/parents`
}

export function taskAttachmentsApiPath (
  orgSlug: string,
  workspaceId: PathId,
  taskId: PathId,
): string {
  return `${taskApiPath(orgSlug, workspaceId, taskId)}/attachments`
}

export function taskAttachmentApiPath (
  orgSlug: string,
  workspaceId: PathId,
  taskId: PathId,
  attachmentId: PathId,
): string {
  return `${taskAttachmentsApiPath(orgSlug, workspaceId, taskId)}/${attachmentId}`
}

export function taskAttachmentDownloadApiPath (
  orgSlug: string,
  workspaceId: PathId,
  taskId: PathId,
  attachmentId: PathId,
): string {
  return `${taskAttachmentApiPath(orgSlug, workspaceId, taskId, attachmentId)}/download`
}

export function workspaceDocumentsApiPath (orgSlug: string, workspaceId: PathId): string {
  return `${workspaceApiPath(orgSlug, workspaceId)}/documents`
}

export function workspaceDocumentApiPath (
  orgSlug: string,
  workspaceId: PathId,
  documentId: PathId,
): string {
  return `${workspaceDocumentsApiPath(orgSlug, workspaceId)}/${documentId}`
}
