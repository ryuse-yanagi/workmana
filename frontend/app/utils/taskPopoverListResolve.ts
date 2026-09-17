export type WorkspaceListOption = {
  id: number
  name: string
  color: string
  sort_order?: number
  color_index?: number
}

export function resolveListName (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.name ?? null
}

export function resolveListColor (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.color ?? null
}
