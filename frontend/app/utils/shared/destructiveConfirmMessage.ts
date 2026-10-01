/**
 * 削除・アーカイブ・復元確認モーダル用の統一メッセージ。
 * 例:
 * このタスクを削除します。よろしいですか？
 *
 * 【対象】
 * タスク名
 */
export function buildDestructiveConfirmMessage (
  kind: string,
  action: '削除' | 'アーカイブ' | '復元',
  itemName?: string | null,
  extraMessage?: string | null,
): string {
  const lines = [`この${kind}を${action}します。よろしいですか？`]
  const name = itemName?.trim()
  if (name) {
    lines.push('', '【対象】', name)
  }
  const extra = extraMessage?.trim()
  if (extra) {
    lines.push('', extra)
  }
  return lines.join('\n')
}
