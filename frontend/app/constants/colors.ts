/**
 * アプリ共通 UI 色の単一ソース。
 * SCSS は `--tm-*` CSS 変数経由、ランタイムは COLORS を直接参照する。
 */

export const COLORS = {
  main: '#0c66e4',
  accent: '#2563eb',
  accentDeep: '#1d4ed8',
  danger: '#f24545',
  dangerText: '#b91c1c',
  dangerBright: '#ef4444',
  success: '#16a34a',
  successText: '#15803d',
  successStrong: '#166534',
  teal: '#0f766e',
  white: '#ffffff',
  gray: '#e2e8f0',
  spinnerTrack: '#dddddd',
  spinnerAccent: '#3498db',
  memberAvatarAccent: '#a67c52',
  chatAvatarMuted: '#6b7f94',
  globalHeaderBg: '#28384a',
  surfaceCanvas: '#f5f6fa',
  surfaceMuted: '#f1f5f9',
  listColumnBg: '#f8fafc',
  surfaceHover: '#f0f0f0',
  surfaceSubtle: '#f3f4f6',
  surfaceFaint: '#f9fafb',
  surfacePanel: '#f4f5f7',
  mainAquaSurface: '#eef5ff',
  mainAquaSurfaceLight: '#f7fbff',
  dangerSurface: '#fef2f2',
  infoSurface: '#eff6ff',
  infoSurfaceStrong: '#dbeafe',
  infoBorder: '#bfdbfe',
  chatMineSurface: '#e8f0ff',
  overlayNavy: '#091e420f',
  text: '#000000',
  textSub: '#475569',
  textMuted: '#64748b',
  textStrong: '#334155',
  textHeading: '#1e293b',
  textEmphasis: '#0f2945',
  textOnSurface: '#172b4d',
  textPlaceholder: '#94a3b8',
  textSubtle: '#5e6c84',
  textSoft: '#6b7280',
  textFaint: '#9ca3af',
  textDisabled: '#d1d5db',
  textInk: '#0f172a',
  textInkSoft: '#111827',
  textSecondaryAlt: '#626f86',
  textHint: '#97a0af',
  textQuiet: '#a2abb6',
  infoText: '#1e3a8a',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  borderSoft: '#dbe3ee',
  borderDivider: '#dfe1e6',
  borderMuted: '#8590a2',
  borderNeutral: '#e5e7eb',
  borderPale: '#edf2f7',
  editBorder: '#ff8a00',
  ink: '#0f172a',
  scrollbarThumb: '#0f172a1a',
} as const

/** rgba(var(--tm-*-rgb), α) 用チャンネル */
export const COLOR_RGB = {
  ink: '15, 23, 42',
  white: '255, 255, 255',
  black: '0, 0, 0',
  accent: '37, 99, 235',
  placeholder: '148, 163, 184',
  emphasis: '15, 41, 69',
} as const

export type AppColorToken = keyof typeof COLORS

function toKebab (key: string): string {
  return key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)
}

/** `:root { --tm-… }` — nuxt head に注入する */
export function colorsRootCss (): string {
  const decls: string[] = []
  for (const [key, value] of Object.entries(COLORS)) {
    decls.push(`--tm-${toKebab(key)}:${value}`)
  }
  for (const [key, value] of Object.entries(COLOR_RGB)) {
    decls.push(`--tm-${toKebab(key)}-rgb:${value}`)
  }
  return `:root{${decls.join(';')}}`
}

export function inkAlpha (alpha: number): string {
  return `rgba(${COLOR_RGB.ink}, ${alpha})`
}
