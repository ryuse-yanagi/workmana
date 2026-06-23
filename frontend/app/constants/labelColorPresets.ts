/**
 * ラベル色プリセット（30色 / 6行×5列）
 */
export const LABEL_COLOR_GRID_COLUMNS = 5

export const LABEL_COLOR_PRESETS = [
  // 1行目 — 淡色
  '#baf3db',
  '#fef3b0',
  '#fce4a6',
  '#ffd5d2',
  '#eed7fc',
  // 2行目 — 標準
  '#4bce97',
  '#ffe600',
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
  '#d3f1a7',
  '#f8c2e4',
  '#dddee1',
  // 5行目 — 標準
  '#669df1',
  '#6cc3e0',
  '#94c748',
  '#fe84cf',
  '#8c8f97',
  // 6行目 — 濃色
  '#1868db',
  '#227d9b',
  '#5b7f24',
  '#b8367d',
  '#6b6e76',
] as const

export const DEFAULT_LABEL_COLOR = LABEL_COLOR_PRESETS[5]

/** 標準ラベル色（10色）— LABEL_COLOR_PRESETS の2行目・5行目 */
export const STANDARD_LABEL_COLORS = [
  LABEL_COLOR_PRESETS[5],
  LABEL_COLOR_PRESETS[6],
  LABEL_COLOR_PRESETS[7],
  LABEL_COLOR_PRESETS[8],
  LABEL_COLOR_PRESETS[9],
  LABEL_COLOR_PRESETS[20],
  LABEL_COLOR_PRESETS[21],
  LABEL_COLOR_PRESETS[22],
  LABEL_COLOR_PRESETS[23],
  LABEL_COLOR_PRESETS[24],
] as const

export const DEFAULT_BOARD_LIST_COLOR = STANDARD_LABEL_COLORS[0]

/**
 * リスト列背景色（標準10色に対応・ラベル淡色よりさらに薄い）
 * STANDARD_LABEL_COLORS と同じ順・同じ列
 */
export const LIST_COLUMN_BACKGROUND_COLORS = [
  '#e7fbf2',
  '#fffbe3',
  '#fef6e0',
  '#fff0ef',
  '#f9f1fe',
  '#eef5fd',
  '#ebf9fe',
  '#f0fae0',
  '#fdeaf6',
  '#f3f3f5',
] as const

export const DEFAULT_LIST_COLUMN_BACKGROUND = LIST_COLUMN_BACKGROUND_COLORS[0]

const LIST_COLUMN_BACKGROUND_BY_STANDARD_COLOR = Object.fromEntries(
  STANDARD_LABEL_COLORS.map((color, index) => [
    color.toLowerCase(),
    LIST_COLUMN_BACKGROUND_COLORS[index],
  ]),
) as Record<string, string>

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

/** 淡色スウォッチ（1行目・4行目）のインデックス */
const LIGHT_LABEL_COLOR_INDICES = new Set([0, 1, 2, 3, 4, 15, 16, 17, 18, 19])

/** 枠線コントラストが弱い色は専用の濃い枠線を使う */
const LABEL_SWATCH_BORDER_OVERRIDES: Readonly<Record<string, string>> = {
  '#fef3b0': '#b89400',
  '#ffe600': '#9a7300',
  '#b89400': '#7a5c00',
}

function findLabelColorPresetIndex (hex: string): number {
  const normalized = hex.toLowerCase()
  return LABEL_COLOR_PRESETS.findIndex(color => color.toLowerCase() === normalized)
}

function swatchLuminance (hex: string): number {
  const rgb = parseHexColor(hex)
  if (!rgb) {
    return 0
  }
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
}

/** リスト列の背景色（選択した標準色に対応するリスト専用の薄い色） */
export function listColumnBackgroundColor (hex: string): string {
  return LIST_COLUMN_BACKGROUND_BY_STANDARD_COLOR[hex.toLowerCase()] ?? '#ffffff'
}

/** スウォッチ枠線（淡色は同列の標準色、標準色も淡い場合は濃色） */
export function labelSwatchBorderColor (hex: string): string {
  const normalized = hex.toLowerCase()
  const override = LABEL_SWATCH_BORDER_OVERRIDES[normalized]
  if (override) {
    return override
  }

  const presetIndex = findLabelColorPresetIndex(hex)
  if (presetIndex >= 0 && LIGHT_LABEL_COLOR_INDICES.has(presetIndex)) {
    const standard = LABEL_COLOR_PRESETS[presetIndex + 5] ?? hex
    const dark = LABEL_COLOR_PRESETS[presetIndex + 10] ?? standard
    const standardLum = swatchLuminance(standard)
    const fillLum = swatchLuminance(hex)
    if (standardLum > 0.75 || (fillLum > 0.85 && standardLum - fillLum < 0.15)) {
      return dark
    }
    return standard
  }

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
