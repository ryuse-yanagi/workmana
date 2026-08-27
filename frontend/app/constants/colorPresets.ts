/**
 * アプリ共通の色プリセット（30色 / 6行×5列）
 * ラベル・リスト列など、UI 全体の色はこのファイルで一元管理する。
 * UI クローム色は _mixin.scss。ここはユーザー選択パレットのみ。
 */
export const COLOR_PRESET_GRID_COLUMNS = 5
export const COLOR_PRESETS = [
  // 1行目 — 淡色
  '#baf3db',
  '#fef3b0',
  '#fce4a6',
  '#ffd5d2',
  '#eed7fc',
  // 2行目 — 標準
  '#4bce97',
  '#f3dd19',
  '#fea72f',
  '#ff624d',
  '#c883e2',
  // 3行目 — 濃色
  '#1f845a',
  '#946f00',
  '#bd5b00',
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
export const DEFAULT_COLOR_PRESET = COLOR_PRESETS[5]
/** 標準色（10色）— COLOR_PRESETS の2行目・5行目 */
export const STANDARD_COLORS = [
  COLOR_PRESETS[5],
  COLOR_PRESETS[6],
  COLOR_PRESETS[7],
  COLOR_PRESETS[8],
  COLOR_PRESETS[9],
  COLOR_PRESETS[20],
  COLOR_PRESETS[21],
  COLOR_PRESETS[22],
  COLOR_PRESETS[23],
  COLOR_PRESETS[24],
] as const
export const DEFAULT_STANDARD_COLOR = STANDARD_COLORS[0]
/** 標準色（10色）— COLOR_PRESETS 内のインデックス */
export const STANDARD_COLOR_PRESET_INDICES = [5, 6, 7, 8, 9, 20, 21, 22, 23, 24] as const
/**
 * ガントバー自動配色の循環順（赤→オレンジ→黄→青→水色→緑→黄緑→紫→ピンク→灰）
 * 10色のあとは先頭の赤に戻る
 */
export const GANTT_BAR_COLOR_SEQUENCE = [
  COLOR_PRESETS[8],  // 赤
  COLOR_PRESETS[7],  // オレンジ
  COLOR_PRESETS[6],  // 黄色
  COLOR_PRESETS[20], // 青
  COLOR_PRESETS[21], // 水色
  COLOR_PRESETS[5],  // 緑
  COLOR_PRESETS[22], // 黄緑
  COLOR_PRESETS[9],  // 紫
  COLOR_PRESETS[23], // ピンク
  COLOR_PRESETS[24], // 灰色
] as const
export const DEFAULT_GANTT_BAR_COLOR = GANTT_BAR_COLOR_SEQUENCE[0]
export function ganttBarColorAtSequenceIndex (sequenceIndex: number): string {
  const len = GANTT_BAR_COLOR_SEQUENCE.length
  const normalized = ((sequenceIndex % len) + len) % len
  return GANTT_BAR_COLOR_SEQUENCE[normalized]!
}
export const DEFAULT_COLOR_PRESET_INDEX = 5
export const DEFAULT_STANDARD_COLOR_INDEX = 0
export function colorAtPresetIndex (index: number): string {
  return COLOR_PRESETS[index] ?? DEFAULT_COLOR_PRESET
}
export function colorPresetIndexFromHex (hex: string): number {
  const idx = findColorPresetIndex(hex)
  return idx >= 0 ? idx : DEFAULT_COLOR_PRESET_INDEX
}
export function standardColorAtIndex (standardIndex: number): string {
  const presetIndex = STANDARD_COLOR_PRESET_INDICES[standardIndex]
  return presetIndex !== undefined ? colorAtPresetIndex(presetIndex) : DEFAULT_STANDARD_COLOR
}
export function standardColorIndexFromHex (hex: string): number {
  const normalized = hex.toLowerCase()
  const idx = STANDARD_COLOR_PRESET_INDICES.findIndex(
    presetIndex => COLOR_PRESETS[presetIndex].toLowerCase() === normalized,
  )
  return idx >= 0 ? idx : DEFAULT_STANDARD_COLOR_INDEX
}
export function normalizeColorPresetIndex (value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(Math.max(value, 0), COLOR_PRESETS.length - 1)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return normalizeColorPresetIndex(Number.parseInt(value, 10))
  }
  if (typeof value === 'string' && value.startsWith('#')) {
    return colorPresetIndexFromHex(value)
  }
  return DEFAULT_COLOR_PRESET_INDEX
}
export function normalizeStandardColorIndex (value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(Math.max(value, 0), STANDARD_COLOR_PRESET_INDICES.length - 1)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return normalizeStandardColorIndex(Number.parseInt(value, 10))
  }
  if (typeof value === 'string' && value.startsWith('#')) {
    return standardColorIndexFromHex(value)
  }
  return DEFAULT_STANDARD_COLOR_INDEX
}
/**
 * 標準色に対応する薄い背景色（リスト列など）
 * STANDARD_COLORS と同じ順・同じ列
 */
export const STANDARD_COLOR_SURFACE_BACKGROUNDS = [
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
export const DEFAULT_STANDARD_COLOR_SURFACE = STANDARD_COLOR_SURFACE_BACKGROUNDS[0]
const STANDARD_COLOR_SURFACE_BY_COLOR = Object.fromEntries(
  STANDARD_COLORS.map((color, index) => [
    color.toLowerCase(),
    STANDARD_COLOR_SURFACE_BACKGROUNDS[index],
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
const LIGHT_COLOR_PRESET_INDICES = new Set([0, 1, 2, 3, 4, 15, 16, 17, 18, 19])
/** 標準色スウォッチ（2行目・5行目）のインデックス */
const STANDARD_COLOR_PRESET_INDEX_SET = new Set<number>(STANDARD_COLOR_PRESET_INDICES)
/** 枠線コントラストが弱い色は専用の濃い枠線を使う */
const COLOR_SWATCH_BORDER_OVERRIDES: Readonly<Record<string, string>> = {
  '#fef3b0': '#946f00',
  '#ffe600': '#9a7300',
}
function findColorPresetIndex (hex: string): number {
  const normalized = hex.toLowerCase()
  return COLOR_PRESETS.findIndex(color => color.toLowerCase() === normalized)
}
/** 同列の濃色（淡色なら標準色、標準色なら濃色） */
function darkColorForPresetIndex (presetIndex: number): string | null {
  const dark = COLOR_PRESETS[presetIndex + 5]
  return dark ?? null
}
/** 標準色に対応する薄い背景色（リスト列など） */
export function standardColorSurfaceBackground (hex: string): string {
  return STANDARD_COLOR_SURFACE_BY_COLOR[hex.toLowerCase()] ?? '#fff'
}
/** 標準色に対応する濃い文字色（ステータスバッジなど） */
export function standardColorEmphasisText (hex: string): string {
  const standardIndex = standardColorIndexFromHex(hex)
  const presetIndex = STANDARD_COLOR_PRESET_INDICES[standardIndex]
  if (presetIndex === undefined) {
    return COLOR_PRESETS[10]
  }
  return COLOR_PRESETS[presetIndex + 5] ?? COLOR_PRESETS[10]
}
/** スウォッチ枠線（淡色・標準色は同列の濃色） */
export function colorSwatchBorderColor (hex: string): string {
  const normalized = hex.toLowerCase()
  const override = COLOR_SWATCH_BORDER_OVERRIDES[normalized]
  if (override) {
    return override
  }
  const presetIndex = findColorPresetIndex(hex)
  if (presetIndex >= 0 && (
    LIGHT_COLOR_PRESET_INDICES.has(presetIndex)
    || STANDARD_COLOR_PRESET_INDEX_SET.has(presetIndex)
  )) {
    return darkColorForPresetIndex(presetIndex) ?? hex
  }
  const rgb = parseHexColor(hex)
  if (!rgb) {
    return 'rgba(15, 23, 42, 0.18)' // mixin.$ink @ 0.18
  }
  const factor = 0.82
  return `rgb(${Math.round(rgb[0] * factor)}, ${Math.round(rgb[1] * factor)}, ${Math.round(rgb[2] * factor)})`
}
/**
 * ガントバー選択枠の色
 * 淡色→標準色、標準色→濃色、濃色→$text-sub
 */
export function ganttBarSelectionBorderColor (hex: string): string {
  const presetIndex = findColorPresetIndex(hex)
  if (presetIndex < 0) {
    return colorSwatchBorderColor(hex)
  }
  if (LIGHT_COLOR_PRESET_INDICES.has(presetIndex)) {
    return COLOR_PRESETS[presetIndex + 5] ?? hex
  }
  if (STANDARD_COLOR_PRESET_INDEX_SET.has(presetIndex)) {
    return COLOR_PRESETS[presetIndex + 5] ?? hex
  }
  return '#475569' // mixin.$text-sub
}
/** 選択チェックマークの色（標準色は白、それ以外は背景輝度で白/黒） */
export function colorSwatchCheckColor (hex: string): string {
  const presetIndex = findColorPresetIndex(hex)
  if (presetIndex >= 0 && STANDARD_COLOR_PRESET_INDEX_SET.has(presetIndex)) {
    return '#fff'
  }
  const rgb = parseHexColor(hex)
  if (!rgb) {
    return '#fff'
  }
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return luminance > 0.72 ? '#334155' : '#fff' // $text-strong / $white
}
