import {
  closeExclusivePopoverIfOpen,
  isExclusivePopoverOpen,
} from '../composables/useExclusivePopover'
import { shouldDismissPopoverForPointerTarget } from '../utils/uiInteraction'

export default defineNuxtPlugin(() => {
  if (!import.meta.client) {
    return
  }

  function dismissOpenPopoverForTarget (target: EventTarget | null) {
    if (!isExclusivePopoverOpen()) {
      return
    }
    if (!(target instanceof Node)) {
      return
    }
    if (!shouldDismissPopoverForPointerTarget(target)) {
      return
    }
    closeExclusivePopoverIfOpen()
  }

  const onDocumentClickCapture = (event: MouseEvent) => {
    dismissOpenPopoverForTarget(event.target)
  }

  document.addEventListener('click', onDocumentClickCapture, true)

  const router = useRouter()
  router.beforeEach(() => {
    closeExclusivePopoverIfOpen()
    return true
  })
})
