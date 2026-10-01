/** API / 画面ゲートで「存在しない・到達不能」とみなすメッセージか */
export function isMissingResourceMessage (message: string): boolean {
  return /No query results|not found|見つかりません|404|Invalid (workspace|document) id/i.test(message)
}

/** 権限不足・組織外などアクセス拒否とみなすメッセージか */
export function isForbiddenResourceMessage (message: string): boolean {
  return /Forbidden|Not allowed|Unauthenticated|Only organization admins|403|401/i.test(message)
}

export function isAccessDeniedMessage (message: string): boolean {
  return isMissingResourceMessage(message) || isForbiddenResourceMessage(message)
}
