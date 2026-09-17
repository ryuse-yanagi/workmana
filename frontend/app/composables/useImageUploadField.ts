import { resolveAvatarUrl } from '../utils/resolveAvatarUrl'

/**
 * Shared image pick / drag-drop / local preview state for avatar & org icon uploads.
 */
export function useImageUploadField () {
  const config = useRuntimeConfig()

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const previewUrl = ref<string | null>(null)
  const currentUrl = ref<string | null>(null)
  const selectedFile = ref<File | null>(null)
  const resetPending = ref(false)
  const localPreviewObjectUrl = ref<string | null>(null)
  const imageFailed = ref(false)
  const dropActive = ref(false)
  const dragDepth = ref(0)
  const fieldError = ref<string | null>(null)

  const displaySrc = computed(() => {
    if (imageFailed.value || !previewUrl.value) {
      return null
    }
    if (localPreviewObjectUrl.value && previewUrl.value === localPreviewObjectUrl.value) {
      return previewUrl.value
    }
    return resolveAvatarUrl(
      previewUrl.value,
      String(config.public.apiBaseUrl || '/api'),
    )
  })

  const canReset = computed(() => Boolean(displaySrc.value))

  function onImageError () {
    imageFailed.value = true
  }

  function revokeLocalPreview () {
    if (localPreviewObjectUrl.value) {
      URL.revokeObjectURL(localPreviewObjectUrl.value)
      localPreviewObjectUrl.value = null
    }
  }

  function clearFileInput () {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  function hydrateFromUrl (url: string | null) {
    currentUrl.value = url
    previewUrl.value = url
    selectedFile.value = null
    resetPending.value = false
    imageFailed.value = false
    dropActive.value = false
    dragDepth.value = 0
    revokeLocalPreview()
    clearFileInput()
    fieldError.value = null
  }

  function openFileDialog (loading: boolean) {
    if (loading) return
    fileInputRef.value?.click()
  }

  function applyFile (file: File | null, onClearedError?: () => void) {
    fieldError.value = null
    onClearedError?.()
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      fieldError.value = '画像ファイルを選択してください'
      return
    }
    revokeLocalPreview()
    selectedFile.value = file
    resetPending.value = false
    imageFailed.value = false
    const objectUrl = URL.createObjectURL(file)
    localPreviewObjectUrl.value = objectUrl
    previewUrl.value = objectUrl
  }

  function onFileChange (event: Event, onClearedError?: () => void) {
    const input = event.target as HTMLInputElement
    applyFile(input.files?.[0] ?? null, onClearedError)
  }

  function onDragEnter (loading: boolean) {
    if (loading) return
    dragDepth.value += 1
    dropActive.value = true
  }

  function onDragOver (loading: boolean) {
    if (loading) return
    dropActive.value = true
  }

  function onDragLeave () {
    dragDepth.value = Math.max(0, dragDepth.value - 1)
    if (dragDepth.value === 0) {
      dropActive.value = false
    }
  }

  function onDrop (event: DragEvent, loading: boolean, onClearedError?: () => void) {
    dragDepth.value = 0
    dropActive.value = false
    if (loading) return
    const file = event.dataTransfer?.files?.[0] ?? null
    applyFile(file, onClearedError)
  }

  function resetToDefault (loading: boolean, onClearedError?: () => void) {
    if (loading || !canReset.value) return
    fieldError.value = null
    onClearedError?.()
    selectedFile.value = null
    resetPending.value = Boolean(currentUrl.value)
    imageFailed.value = false
    revokeLocalPreview()
    previewUrl.value = null
    clearFileInput()
  }

  function markUploaded (nextUrl: string | null) {
    currentUrl.value = nextUrl
    previewUrl.value = nextUrl
    selectedFile.value = null
    resetPending.value = false
    revokeLocalPreview()
  }

  onBeforeUnmount(() => {
    revokeLocalPreview()
  })

  return {
    fileInputRef,
    previewUrl,
    currentUrl,
    selectedFile,
    resetPending,
    fieldError,
    displaySrc,
    canReset,
    dropActive,
    onImageError,
    revokeLocalPreview,
    hydrateFromUrl,
    openFileDialog,
    onFileChange,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    resetToDefault,
    markUploaded,
  }
}
