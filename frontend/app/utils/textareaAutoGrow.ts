/** 説明 textarea など — 入力に応じて縦方向へ伸長させる */
export function adjustTextareaHeight (textarea: HTMLTextAreaElement | null | undefined): void {
  if (!textarea) {
    return
  }
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}
