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
/** 担当者・メンバー一覧の表示順（名前 → id）。API 側の並びと揃える */
export function compareMembersByDisplayName (a: MemberLike, b: MemberLike): number {
  const byName = memberDisplayName(a).localeCompare(memberDisplayName(b), 'ja')
  if (byName !== 0) {
    return byName
  }
  return a.id - b.id
}
export function sortMembersByDisplayName<T extends MemberLike> (members: T[]): T[] {
  if (members.length < 2) {
    return members
  }
  let ordered = true
  for (let i = 1; i < members.length; i += 1) {
    if (compareMembersByDisplayName(members[i - 1]!, members[i]!) > 0) {
      ordered = false
      break
    }
  }
  if (ordered) {
    return members
  }
  return [...members].sort(compareMembersByDisplayName)
}
