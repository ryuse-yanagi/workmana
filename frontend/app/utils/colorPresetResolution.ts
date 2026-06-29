import {
  colorAtPresetIndex,
  normalizeColorPresetIndex,
  normalizeStandardColorIndex,
  standardColorAtIndex,
} from '../constants/colorPresets'
export type ColorIndexedEntity = {
  color_index?: number
  color?: string
}
function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function resolveColorIndexedRecord (record: Record<string, unknown>): Record<string, unknown> {
  const hasColorIndex = typeof record.color_index === 'number'
    || (typeof record.color_index === 'string' && /^\d+$/.test(record.color_index))
  if (!hasColorIndex) {
    return record
  }
  if (record.category_id !== undefined) {
    return withResolvedLabelColor(record as ColorIndexedEntity) as Record<string, unknown>
  }
  const isListColor = typeof record.sort_order === 'number'
    || (typeof record.sort_order === 'string' && /^\d+$/.test(record.sort_order))
  if (isListColor && record.workspace_id !== undefined) {
    return withResolvedListColor(record as ColorIndexedEntity) as Record<string, unknown>
  }
  return withResolvedLabelColor(record as ColorIndexedEntity) as Record<string, unknown>
}
/** API レスポンス内の color_index を、現在のプリセットから color に解決する */
export function deepNormalizeColorIndexedPayload<T> (payload: T): T {
  if (payload === null || payload === undefined) {
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.map(item => deepNormalizeColorIndexedPayload(item)) as T
  }
  if (!isRecord(payload)) {
    return payload
  }
  const resolved = resolveColorIndexedRecord(payload)
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(resolved)) {
    normalized[key] = deepNormalizeColorIndexedPayload(value)
  }
  return normalized as T
}
export function withResolvedLabelColor<T extends ColorIndexedEntity> (
  item: T,
): T & { color_index: number; color: string } {
  const color_index = normalizeColorPresetIndex(item.color_index ?? item.color)
  return {
    ...item,
    color_index,
    color: colorAtPresetIndex(color_index),
  }
}
export function withResolvedListColor<T extends ColorIndexedEntity> (
  item: T,
): T & { color_index: number; color: string } {
  const color_index = normalizeStandardColorIndex(item.color_index ?? item.color)
  return {
    ...item,
    color_index,
    color: standardColorAtIndex(color_index),
  }
}
export function resolveLabelColors<T extends ColorIndexedEntity> (
  items: T[],
): Array<T & { color_index: number; color: string }> {
  return items.map(withResolvedLabelColor)
}
export function resolveListColors<T extends ColorIndexedEntity> (
  items: T[],
): Array<T & { color_index: number; color: string }> {
  return items.map(withResolvedListColor)
}
