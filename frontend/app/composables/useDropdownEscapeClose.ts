import { onBeforeUnmount, watch, type WatchSource } from 'vue'

type DropdownEscapeCloseOptions = {
  capture?: boolean
}

export function useDropdownEscapeClose (
  isOpen: WatchSource<boolean>,
  close: () => void,
  options: DropdownEscapeCloseOptions = {},
) {
  const capture = options.capture ?? true
  let listening = false

  function onEscape (event: KeyboardEvent) {
    if (event.key !== 'Escape') {
      return
    }
    const open = typeof isOpen === 'function' ? isOpen() : isOpen.value
    if (!open) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  function bind () {
    if (listening) {
      return
    }
    document.addEventListener('keydown', onEscape, capture)
    listening = true
  }

  function unbind () {
    if (!listening) {
      return
    }
    document.removeEventListener('keydown', onEscape, capture)
    listening = false
  }

  watch(isOpen, (open) => {
    if (open) {
      bind()
      return
    }
    unbind()
  }, { immediate: true })

  onBeforeUnmount(unbind)
}
