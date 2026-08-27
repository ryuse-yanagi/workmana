import { resolveLabelColors } from '../utils/colorPresetResolution'

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
