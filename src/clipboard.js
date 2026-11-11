// Clipboard helpers. LTCopyToClipboard copies plain text only (its one
// content prop is `textToCopy: string`, COMPONENTS.md), so a table copied with
// its rows and columns intact (v2 item 10) is composed here and flagged in
// automation-details.md §9.

/** Plain text, with the execCommand fallback for blocked clipboard access. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return legacyCopy({ text })
  }
}

/**
 * HTML and plain text together. Rich editors (Docs, Notion, Confluence,
 * email) paste the HTML table; spreadsheets and plain editors paste the
 * tab-separated text, one row per line.
 */
export async function copyRich({ text, html }) {
  try {
    if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('ClipboardItem unavailable')
    await navigator.clipboard.write([new window.ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })])
    return true
  } catch {
    return legacyCopy({ text, html })
  }
}

function legacyCopy({ text, html }) {
  const onCopy = e => {
    e.preventDefault()
    e.clipboardData.setData('text/plain', text)
    if (html) e.clipboardData.setData('text/html', html)
  }
  document.addEventListener('copy', onCopy)
  try { return document.execCommand('copy') } catch { return false } finally { document.removeEventListener('copy', onCopy) }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cell = s => String(s).replace(/[\t\r\n]+/g, ' ')

/** A table as tab-separated text plus an HTML table, header row first. */
export function tableClipboard(columns, rows) {
  const head = columns.map(c => c.title)
  const body = rows.map(r => columns.map(c => r[c.key] ?? ''))
  return {
    text: [head, ...body].map(r => r.map(cell).join('\t')).join('\n'),
    html: `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      body.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
  }
}
