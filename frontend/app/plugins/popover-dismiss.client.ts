import {
  closeExclusivePopoverIfOpen,
  isExclusivePopoverOpen,
} from '../composables/ui/useExclusivePopover'
import { shouldDismissPopoverForPointerTarget } from '../utils/ui/uiInteraction'

/**
 * 排他ポップオーバーを、外側クリックと画面遷移で閉じる。
 */
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
