export type MemberLike = {
  id: number
  name: string | null
  email?: string | null
  avatar_url?: string | null
}
export function memberDisplayName (member: MemberLike): string {
  return (member.name || member.email || `ユーザー #${member.id}`).trim()
}
export function memberInitial (member: MemberLike): string {
  return memberDisplayName(member).slice(0, 1).toUpperCase()
}
