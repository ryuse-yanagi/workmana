/**
 * ドメイン共通 DTO。
 * 画面固有の別名はここを参照する type alias に揃え、形状の重複定義を避ける。
 */

/** ラベルの最小形（id + 表示名 + 色） */
export type NamedColorLabel = {
  id: number
  name: string
  color: string
}

/** 組織カタログ上のラベル（並び・カテゴリ付き） */
export type CatalogLabel = NamedColorLabel & {
  color_index?: number
  category_id?: number
  sort_order?: number
}

/** 名前付きカラー項目（ステータス・カテゴリなど id なし） */
export type NamedColorItem = {
  name: string
  color: string
}

/** メンバーの標準プロフィール（担当者・組織メンバー共通） */
export type OrgMemberProfile = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}

/** 親タスク参照（ピッカー・ボード・詳細で共通） */
export type ParentTaskRef = {
  id: number
  title: string
}
