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

const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'input', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'ul',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  ol: new Set(['start']),
  ul: new Set(['class']),
  li: new Set(['class']),
  input: new Set(['class', 'type', 'disabled', 'checked']),
  code: new Set(['class']),
  th: new Set(['align']),
  td: new Set(['align']),
}

function escapeHtml (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeUrl (value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.startsWith('#')) {
    return true
  }
  const lower = trimmed.toLowerCase()
  return lower.startsWith('http://')
    || lower.startsWith('https://')
    || lower.startsWith('mailto:')
    || (lower.startsWith('/') && !lower.startsWith('//') && !lower.startsWith('/\\'))
}

/**
 * SSR / CSR 共通の許可リスト型サニタイザ。
 * marked の出力を信頼せず、許可タグ・属性以外は除去する。
 */
function sanitizeHtml (html: string): string {
  if (typeof DOMParser !== 'undefined') {
    return sanitizeWithDomParser(html)
  }
  return sanitizeWithRegex(html)
}

function sanitizeWithDomParser (html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node) => {
    const children = [...node.childNodes]
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element
        const tag = el.tagName.toLowerCase()
        if (!ALLOWED_TAGS.has(tag)) {
          el.replaceWith(...el.childNodes)
          walk(node)
          continue
        }
        const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>()
        for (const attr of [...el.attributes]) {
          const name = attr.name.toLowerCase()
          if (!allowed.has(name)) {
            el.removeAttribute(attr.name)
            continue
          }
          if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
            el.removeAttribute(attr.name)
          }
          if (tag === 'input') {
            if (name === 'type' && attr.value.toLowerCase() !== 'checkbox') {
              el.removeAttribute(attr.name)
            }
          }
        }
        if (tag === 'input') {
          el.setAttribute('disabled', '')
          el.setAttribute('type', 'checkbox')
        }
        walk(el)
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child)
      }
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

function sanitizeWithRegex (html: string): string {
  // コメントと危険タグを丸ごと除去
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(script|iframe|object|embed|form|link|meta|style|base|svg|math|textarea)[^>]*>/gi, '')

  out = out.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, rawTag: string, rawAttrs = '') => {
    const tag = rawTag.toLowerCase()
    const isClose = full.startsWith('</')
    if (!ALLOWED_TAGS.has(tag)) {
      return ''
    }
    if (isClose) {
      return `</${tag}>`
    }

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>()
    const attrs: string[] = []
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
    let match: RegExpExecArray | null
    while ((match = attrRe.exec(rawAttrs)) !== null) {
      const name = match[1].toLowerCase()
      const value = match[3] ?? match[4] ?? match[5] ?? ''
      if (!allowed.has(name)) {
        continue
      }
      if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
        continue
      }
      if (tag === 'input' && name === 'type' && value.toLowerCase() !== 'checkbox') {
        continue
      }
      if (name === 'disabled' || name === 'checked') {
        attrs.push(name)
        continue
      }
      attrs.push(`${name}="${escapeHtml(value)}"`)
    }

    if (tag === 'input') {
      attrs.push('type="checkbox"', 'disabled')
    }

    const selfClosing = tag === 'br' || tag === 'hr' || tag === 'input'
    const attrText = attrs.length ? ` ${[...new Set(attrs)].join(' ')}` : ''
    return selfClosing ? `<${tag}${attrText}>` : `<${tag}${attrText}>`
  })

  return out
}

export function renderMarkdownToSafeHtml (
  source: string | null | undefined,
  options?: { preserveLineBreaks?: boolean },
): string {
  const text = source ?? ''
  if (text.trim() === '') {
    return ''
  }
  const parsed = marked.parse(text, {
    async: false,
    breaks: options?.preserveLineBreaks ?? false,
  })
  return sanitizeHtml(typeof parsed === 'string' ? parsed : '')
}
