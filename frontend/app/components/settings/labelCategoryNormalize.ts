import { resolveLabelColors } from '../../utils/colorPresetResolution'
import type { SettingsLabelCategory } from './types'

export function normalizeSettingsLabelCategories (raw: SettingsLabelCategory[]): SettingsLabelCategory[] {
  return raw
    .map(category => ({
      ...category,
      labels: resolveLabelColors([...category.labels].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
}
