import type { Ref } from 'vue'

/**
 * Shared restore/delete confirm-modal state for archived list UIs.
 */
export function useArchiveConfirmPair<T> () {
  const restoreTarget: Ref<T | null> = ref(null)
  const deleteTarget: Ref<T | null> = ref(null)

  const restoreConfirmOpen = computed({
    get: () => restoreTarget.value !== null,
    set: (open: boolean) => {
      if (!open) restoreTarget.value = null
    },
  })
  const deleteConfirmOpen = computed({
    get: () => deleteTarget.value !== null,
    set: (open: boolean) => {
      if (!open) deleteTarget.value = null
    },
  })
  const isConfirmOpen = computed(() => (
    restoreTarget.value !== null || deleteTarget.value !== null
  ))

  function clearConfirmTargets () {
    restoreTarget.value = null
    deleteTarget.value = null
  }

  return {
    restoreTarget,
    deleteTarget,
    restoreConfirmOpen,
    deleteConfirmOpen,
    isConfirmOpen,
    clearConfirmTargets,
  }
}
