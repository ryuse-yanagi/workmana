import { resolveLabelColors } from '../../utils/shared/colorPresetResolution'

export type LabelCategoryItem = {
  id: number
  name: string
  color: string
  color_index?: number
  category_id?: number
  sort_order?: number
}

export type LabelCategoryGroup<TLabel extends LabelCategoryItem = LabelCategoryItem> = {
  id: number
  name: string
  sort_order: number
  labels: TLabel[]
}

/** カテゴリとラベルを sort_order 順にし、ラベル色をプリセットから埋める。 */
export function normalizeLabelCategories<TLabel extends LabelCategoryItem> (
  raw: Array<{
    id: number
    name: string
    sort_order?: number
    labels?: TLabel[]
  }>,
): LabelCategoryGroup<TLabel>[] {
  return raw
    .map(category => ({
      id: category.id,
      name: category.name,
      sort_order: category.sort_order ?? 0,
      labels: resolveLabelColors(
        [...(category.labels ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      ) as TLabel[],
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function flattenLabelCategories<TLabel extends LabelCategoryItem> (
  categories: LabelCategoryGroup<TLabel>[],
): TLabel[] {
  return categories.flatMap(category => category.labels)
}

/** 組織カタログ（カテゴリ順 → ラベル順）に合わせた選択ラベルの比較 */
export function compareLabelsByCatalogOrder (
  a: { id: number },
  b: { id: number },
  orderIndex: Map<number, number>,
): number {
  const ai = orderIndex.get(a.id)
  const bi = orderIndex.get(b.id)
  if (ai !== undefined && bi !== undefined && ai !== bi) {
    return ai - bi
  }
  if (ai !== undefined && bi === undefined) {
    return -1
  }
  if (ai === undefined && bi !== undefined) {
    return 1
  }
  return a.id - b.id
}

/**
 * 選択中ラベルを組織カタログ順に揃える。
 * catalog が空のときは id 昇順で安定化する（シードと詳細取得の順序差を防ぐ）。
 */
export function sortLabelsByCatalogOrder<T extends { id: number }> (
  labels: T[],
  catalogLabels: Array<{ id: number }> = [],
): T[] {
  if (labels.length < 2) {
    return labels
  }
  const orderIndex = new Map(catalogLabels.map((label, index) => [label.id, index]))
  let ordered = true
  for (let i = 1; i < labels.length; i += 1) {
    if (compareLabelsByCatalogOrder(labels[i - 1]!, labels[i]!, orderIndex) > 0) {
      ordered = false
      break
    }
  }
  if (ordered) {
    return labels
  }
  return [...labels].sort((a, b) => compareLabelsByCatalogOrder(a, b, orderIndex))
}

/** 色解決 + カタログ順ソート（タスク／スペースの選択ラベル正規化用） */
export function resolveAndSortLabels<T extends { id: number; color_index?: number; color?: string }> (
  labels: T[] | null | undefined,
  catalogLabels: Array<{ id: number }> = [],
): Array<T & { color_index: number; color: string }> {
  return sortLabelsByCatalogOrder(resolveLabelColors(labels ?? []), catalogLabels)
}

export function filterLabelCategories<TLabel extends LabelCategoryItem> (
  categories: LabelCategoryGroup<TLabel>[],
  query: string,
): LabelCategoryGroup<TLabel>[] {
  const normalizedQuery = query.trim().toLowerCase()
  const withLabels = categories.filter(category => category.labels.length > 0)
  if (!normalizedQuery) {
    return withLabels
  }
  return withLabels
    .map(category => ({
      ...category,
      labels: category.labels.filter(label => label.name.toLowerCase().includes(normalizedQuery)),
    }))
    .filter(category => category.labels.length > 0)
}

export function labelCategoriesFromFlat<TLabel extends LabelCategoryItem> (
  categories: LabelCategoryGroup<TLabel>[] | undefined,
  labels: TLabel[],
): LabelCategoryGroup<TLabel>[] {
  if (categories && categories.length > 0) {
    return categories
  }
  if (!labels.length) {
    return []
  }
  return [{
    id: 0,
    name: '',
    sort_order: 0,
    labels,
  }]
}
