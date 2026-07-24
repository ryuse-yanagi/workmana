export function requiredTextFieldError (value: string, emptyMessage: string): string | null {
  if (!value.trim()) {
    return emptyMessage
  }
  return null
}

export function workspaceNameFieldError (value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'スペース名を入力してください'
  }
  if (trimmed.length < 2) {
    return 'スペース名は2文字以上で入力してください'
  }
  return null
}

export function taskTitleFieldError (value: string): string | null {
  return requiredTextFieldError(value, 'タスク名を入力してください')
}

export function documentNameFieldError (value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return '資料名を入力してください'
  }
  if (trimmed.length < 2) {
    return '資料名は2文字以上で入力してください'
  }
  return null
}
