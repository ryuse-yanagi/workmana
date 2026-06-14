/** WBS・共通資料など、ビューポート内に収めるプレースホルダー画面向け */
export function useProjectViewPageRoot () {
  useHead({
    htmlAttrs: {
      class: 'project-view-page-root',
    },
    bodyAttrs: {
      class: 'project-view-page-root',
    },
  })
}

export function useProjectViewPageCssVars () {
  const globalHeaderOffsetPx = ref(46)

  function readGlobalHeaderHeight (): number {
    if (!import.meta.client) {
      return 46
    }
    const el = document.querySelector('.global-header') as HTMLElement | null
    if (!el) {
      return 46
    }
    return Math.ceil(el.getBoundingClientRect().height)
  }

  function updateHeaderOffset () {
    globalHeaderOffsetPx.value = readGlobalHeaderHeight()
  }

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    updateHeaderOffset()
    window.addEventListener('resize', updateHeaderOffset)
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) {
      return
    }
    window.removeEventListener('resize', updateHeaderOffset)
  })

  return computed(() => ({
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    '--app-shell-page-pad': '0.25rem',
  } as Record<string, string>))
}
