// Formats from design-context mock-data.md § Formats and the text guide §7.
import { NOW } from './data.js'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = n => String(n).padStart(2, '0')

/** MMM DD, YYYY, zero-padded day, UTC so every viewer reads the same date. */
export function absDate(iso) {
  const d = new Date(iso)
  return `${MON[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()}`
}
/** MMM DD, YYYY, HH:MM AM/PM (where the time matters). */
export function absDateTime(iso) {
  const d = new Date(iso)
  const h = d.getUTCHours(), m = d.getUTCMinutes()
  return `${absDate(iso)}, ${pad(((h + 11) % 12) + 1)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
/** Up to 30 days: relative. Older: absolute (mock-data.md). */
export function relTime(iso, now = NOW) {
  const s = Math.max(60, Math.round((now - Date.parse(iso)) / 1000))
  const days = Math.floor(s / 86400)
  if (days > 30) return absDate(iso)
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const h = Math.floor(s / 3600)
  if (h >= 1) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  const m = Math.floor(s / 60)
  return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
}
/** "Updated 4 days ago" or "Updated on Sep 03, 2026". */
export const relOrOn = (iso, now = NOW) => {
  const r = relTime(iso, now)
  return /ago$/.test(r) ? r : `on ${r}`
}
/** Compact duration: 5m 41s, 11s (mock-data.md). */
export function duration(ms) {
  let s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  return [h && `${h}h`, m && `${m}m`, (s || (!h && !m)) && `${s}s`].filter(Boolean).join(' ')
}
/** Latency in seconds, one decimal: 7.4s (gap G3: mock-data.md has no ms format). */
export const latency = ms => (ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`)
/** Counts above 999 in k and M (text guide §2). */
export function count(n) {
  if (n < 1000) return String(n)
  const k = n >= 1e6 ? [n / 1e6, 'M'] : [n / 1e3, 'k']
  return `${Number(k[0].toFixed(2))}${k[1]}`
}
export const credits = n => `${n.toFixed(1)} credits`
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
