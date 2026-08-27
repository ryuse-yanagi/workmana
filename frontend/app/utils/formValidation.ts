import {
  DOCUMENT_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../constants/fieldLengthLimits'

export const REQUIRED_TEXT_MIN_LENGTH = 1
export const PASSWORD_MIN_LENGTH = 8

export function lengthRangeFieldMessage (
  label: string,
  minLength: number,
  maxLength: number,
): string {
  return `${label}は${minLength}文字以上${maxLength}文字以下で入力してください`
}

export function requiredTextFieldError (
  value: string,
  label: string,
  maxLength: number,
  minLength = REQUIRED_TEXT_MIN_LENGTH,
): string | null {
  const length = value.trim().length
  if (length < minLength || length > maxLength) {
    return lengthRangeFieldMessage(label, minLength, maxLength)
  }
  return null
}

export function passwordFieldError (value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return lengthRangeFieldMessage('パスワード', PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  }
  return null
}

export function emailFieldError (
  value: string,
  emptyMessage = lengthRangeFieldMessage('メールアドレス', REQUIRED_TEXT_MIN_LENGTH, EMAIL_MAX_LENGTH),
  invalidMessage = 'メールアドレスの形式が正しくありません。',
): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return emptyMessage
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return emptyMessage
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return invalidMessage
  }
  return null
}

export function workspaceNameFieldError (value: string): string | null {
  return requiredTextFieldError(value, 'スペース名', WORKSPACE_NAME_MAX_LENGTH)
}

export function taskTitleFieldError (value: string): string | null {
  return requiredTextFieldError(value, 'タスク名', TASK_TITLE_MAX_LENGTH)
}

export function documentNameFieldError (value: string): string | null {
  return requiredTextFieldError(value, '資料名', DOCUMENT_NAME_MAX_LENGTH)
}
