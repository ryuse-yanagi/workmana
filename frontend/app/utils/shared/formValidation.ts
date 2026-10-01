import { z } from 'zod'
import {
  DOCUMENT_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  REQUIRED_TEXT_MIN_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'

export { REQUIRED_TEXT_MIN_LENGTH, PASSWORD_MIN_LENGTH }

export function lengthRangeFieldMessage (
  label: string,
  minLength: number,
  maxLength: number,
): string {
  return `${label}は${minLength}文字以上${maxLength}文字以下で入力してください`
}

function requiredTrimmedStringSchema (label: string, maxLength: number, minLength = REQUIRED_TEXT_MIN_LENGTH) {
  return z.string().superRefine((value, ctx) => {
    const length = value.trim().length
    if (length < minLength || length > maxLength) {
      ctx.addIssue({
        code: 'custom',
        message: lengthRangeFieldMessage(label, minLength, maxLength),
      })
    }
  })
}

function firstIssueMessage (result: z.SafeParseReturnType<unknown, unknown>): string | null {
  if (result.success) {
    return null
  }
  return result.error.issues[0]?.message ?? null
}

export function requiredTextFieldError (
  value: string,
  label: string,
  maxLength: number,
  minLength = REQUIRED_TEXT_MIN_LENGTH,
): string | null {
  return firstIssueMessage(requiredTrimmedStringSchema(label, maxLength, minLength).safeParse(value))
}

export function passwordFieldError (value: string): string | null {
  const schema = z.string().superRefine((v, ctx) => {
    if (v.length < PASSWORD_MIN_LENGTH || v.length > PASSWORD_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: lengthRangeFieldMessage('パスワード', PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
      })
    }
  })
  return firstIssueMessage(schema.safeParse(value))
}

export function emailFieldError (
  value: string,
  emptyMessage = lengthRangeFieldMessage('メールアドレス', REQUIRED_TEXT_MIN_LENGTH, EMAIL_MAX_LENGTH),
  invalidMessage = 'メールアドレスの形式が正しくありません。',
): string | null {
  const schema = z.string().superRefine((v, ctx) => {
    const trimmed = v.trim()
    if (!trimmed || trimmed.length > EMAIL_MAX_LENGTH) {
      ctx.addIssue({ code: 'custom', message: emptyMessage })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      ctx.addIssue({ code: 'custom', message: invalidMessage })
    }
  })
  return firstIssueMessage(schema.safeParse(value))
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
