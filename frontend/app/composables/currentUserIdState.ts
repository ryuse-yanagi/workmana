const currentUserId = ref<number | null>(null)
let pendingFetch: Promise<number | null> | null = null

export function getCurrentUserIdState () {
  return currentUserId
}

export function getCurrentUserPendingFetch () {
  return pendingFetch
}

export function setCurrentUserPendingFetch (value: Promise<number | null> | null) {
  pendingFetch = value
}

export function clearCurrentUserId (): void {
  currentUserId.value = null
  pendingFetch = null
}
