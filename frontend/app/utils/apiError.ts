export function extractApiErrorMessage (
  error: unknown,
  fallback = 'リクエストに失敗しました',
): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message
      if (typeof message === 'string' && message.trim() !== '') {
        return message
      }
    }
    if (error instanceof Error && error.message.trim() !== '') {
      return error.message
    }
  }
  return fallback
}
