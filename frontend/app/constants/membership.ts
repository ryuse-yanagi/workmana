/**
 * 組織メンバーロール・招待ステータス・タスク優先度。
 * バックエンド Enum（MembershipRole / TaskPriority）と値を揃える。
 */

export const MEMBERSHIP_ROLES = ['admin', 'member'] as const
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]

/** UI 向けエイリアス（RoleRadioGroup など） */
export type OrgMemberRole = MembershipRole

export const INVITE_STATUSES = [
  'active',
  'used',
  'expired',
  'invalid',
  'error',
] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
