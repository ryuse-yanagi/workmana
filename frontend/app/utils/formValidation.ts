export function requiredTextFieldError (value: string, emptyMessage: string): string | null {
  if (!value.trim()) {
    return emptyMessage
  }
  return null
}

export function workspaceNameFieldError (value: string): string | null {
  return requiredTextFieldError(value, 'スペース名を入力してください')
}

export function taskTitleFieldError (value: string): string | null {
  return requiredTextFieldError(value, 'タスク名を入力してください')
}

export function documentNameFieldError (value: string): string | null {
  return requiredTextFieldError(value, '資料名を入力してください')
}
