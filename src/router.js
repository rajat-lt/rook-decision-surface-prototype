// Hash routes (spec §3.3), so GitHub Pages serves every screen.
import { useEffect, useState } from 'react'

export function parse(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/projects'
  const [path, qs = ''] = raw.split('?')
  const q = Object.fromEntries(new URLSearchParams(qs))
  const p = path.split('/').filter(Boolean)
  if (p[0] === 'projects' || !p.length) return { page: 'projects', q }
  if (p[0] === 'p' && p[2] === 'agents') return { page: 'agents', project: p[1], q }
  if (p[0] === 'p' && p[2] === 'settings' && p[3] === 'release-policy') return { page: 'policy', project: p[1], q }
  if (p[0] === 'p' && p[2] === 'a') {
    const base = { project: p[1], agent: p[3], q }
    const tab = p[4] || 'overview'
    if (tab === 'runs' && p[5] && p[6] === 's' && p[7]) return { ...base, page: 'result', run: p[5], scenario: p[7] }
    if (tab === 'runs' && p[5]) return { ...base, page: 'run', run: p[5] }
    return { ...base, page: tab }
  }
  return { page: 'notfound', q }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const f = () => { setRoute(parse(window.location.hash)); }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return route
}

/** Builds hrefs. Query values are only ever IDs, never personal data. */
export const href = {
  projects: () => '#/projects',
  agents: (pr = 'web-app') => `#/p/${pr}/agents`,
  policy: (pr = 'web-app') => `#/p/${pr}/settings/release-policy`,
  tab: (tab, q = {}, a = 'refund-desk', pr = 'web-app') => `#/p/${pr}/a/${a}/${tab}${qs(q)}`,
  run: (run, q = {}, a = 'refund-desk', pr = 'web-app') => `#/p/${pr}/a/${a}/runs/${run}${qs(q)}`,
  result: (run, sc, q = {}, a = 'refund-desk', pr = 'web-app') => `#/p/${pr}/a/${a}/runs/${run}/s/${sc}${qs(q)}`,
  compare: (base, head, q = {}) => href.tab('compare', { base, head, ...q }),
}
function qs(q) {
  const e = Object.entries(q).filter(([, v]) => v != null && v !== '')
  return e.length ? `?${new URLSearchParams(e).toString()}` : ''
}

/** Replaces one query value in place, keeping the rest of the route. */
export function setQuery(patch) {
  const raw = window.location.hash.replace(/^#/, '')
  const [path, s = ''] = raw.split('?')
  const q = new URLSearchParams(s)
  for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') q.delete(k); else q.set(k, v) }
  const str = q.toString()
  window.history.replaceState(null, '', `#${path}${str ? `?${str}` : ''}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
