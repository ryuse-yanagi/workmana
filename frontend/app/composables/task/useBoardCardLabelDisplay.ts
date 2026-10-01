const showLabelNames = ref(false)
export function useBoardCardLabelDisplay () {
  function toggleLabelNames () {
    showLabelNames.value = !showLabelNames.value
  }
  return {
    showLabelNames: readonly(showLabelNames),
    toggleLabelNames,
  }
}
