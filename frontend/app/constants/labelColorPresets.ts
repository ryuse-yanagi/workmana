/**
 * ラベル色プリセット（30色 / 6行×5列）
 */
export const LABEL_COLOR_GRID_COLUMNS = 5

export const LABEL_COLOR_PRESETS = [
  // 1行目 — 淡色
  '#baf3db',
  '#f6ea92',
  '#fbd19c',
  '#f0b3ab',
  '#dfc0eb',
  // 2行目 — 標準
  '#4bce97',
  '#f2d918',
  '#fea72f',
  '#ff624d',
  '#c883e2',
  // 3行目 — 濃色
  '#1f845a',
  '#b89400',
  '#c56f0a',
  '#eb1f00',
  '#9e49c5',
  // 4行目 — 淡色
  '#cfe1fd',
  '#c6edfb',
  '#b3f1d0',
  '#f8c2e4',
  '#dddee1',
  // 5行目 — 標準
  '#669df1',
  '#6cc3e0',
  '#61e9a1',
  '#fe84cf',
  '#8c8f97',
  // 6行目 — 濃色
  '#1868db',
  '#227d9b',
  '#24965a',
  '#b8367d',
  '#6b6e76',
] as const

export const DEFAULT_LABEL_COLOR = LABEL_COLOR_PRESETS[5]

function parseHexColor (hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return null
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

/** スウォッチ枠線（同色のやや暗いトーン） */
export function labelSwatchBorderColor (hex: string): string {
  const rgb = parseHexColor(hex)
  if (!rgb) {
    return 'rgba(15, 23, 42, 0.18)'
  }
  const factor = 0.82
  return `rgb(${Math.round(rgb[0] * factor)}, ${Math.round(rgb[1] * factor)}, ${Math.round(rgb[2] * factor)})`
}

/** 選択チェックマークの色（背景の明るさに応じて白/黒） */
export function labelSwatchCheckColor (hex: string): string {
  const rgb = parseHexColor(hex)
  if (!rgb) {
    return '#fff'
  }
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return luminance > 0.72 ? '#334155' : '#fff'
}
