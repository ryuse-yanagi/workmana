import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  // false: 文末スペース2つ + 改行、または <br> でのみ改行する（標準 Markdown）
  breaks: false,
})

marked.use({
  renderer: {
    list (token) {
      const body = token.items.map(item => this.listitem(item)).join('')
      if (token.ordered) {
        const startAttr = token.start !== 1 ? ` start="${token.start}"` : ''
        return `<ol${startAttr}>\n${body}</ol>\n`
      }
      const isTaskList = token.items.some(item => item.task)
      const classAttr = isTaskList ? ' class="contains-task-list"' : ''
      return `<ul${classAttr}>\n${body}</ul>\n`
    },
    listitem (item) {
      const text = this.parser.parse(item.tokens)
      const classAttr = item.task ? ' class="task-list-item"' : ''
      return `<li${classAttr}>${text}</li>\n`
    },
    checkbox ({ checked }) {
      return `<input class="task-list-item-checkbox" type="checkbox" disabled${checked ? ' checked' : ''}> `
    },
  },
})

function sanitizeHtml (html: string): string {
  if (!import.meta.client || typeof DOMParser === 'undefined') {
    return html
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, form, link, meta').forEach((el) => {
    el.remove()
  })
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return doc.body.innerHTML
}

export function renderMarkdownToSafeHtml (source: string | null | undefined): string {
  const text = source ?? ''
  if (text.trim() === '') {
    return ''
  }
  const parsed = marked.parse(text, { async: false })
  return sanitizeHtml(typeof parsed === 'string' ? parsed : '')
}
