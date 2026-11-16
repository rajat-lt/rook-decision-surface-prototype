// App state: the prototype state, shell and viewer (fixed at their defaults
// since the prototype bar left the top bar, 16 Nov 2026) and the triage
// reasons. Triage stays in this browser's local storage as a per-viewer
// convenience (spec §11); every read and write is guarded. The key moved to
// v2 on 16 Nov 2026 (scope cut), so a saved policy and decisions from v1 stop
// loading; a shell or viewer saved under v2 is ignored, as nothing can change
// it back now.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SEED_TRIAGE, NOW } from './data.js'

const KEY = 'rook-decision-surface:v2'
const DEFAULTS = { proto: 'blocked', shell: 'platform', viewer: 'ritika', triage: SEED_TRIAGE }

function load() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw)
    return { ...DEFAULTS, triage: saved.triage ?? DEFAULTS.triage }
  } catch { return DEFAULTS }
}

const Ctx = createContext(null)
export function StoreProvider({ children }) {
  const [s, setS] = useState(load)
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ triage: s.triage })) } catch { /* storage blocked: state lives in memory */ }
  }, [s])
  const set = useCallback(patch => setS(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), [])
  const api = useMemo(() => ({
    ...s,
    set,
    setTriage: (key, patch) => set(prev => {
      const cur = prev.triage[key] ?? {}
      return { triage: { ...prev.triage, [key]: { ...cur, ...patch, setBy: prev.viewer, setAt: new Date(nowMs()).toISOString() } } }
    }),
    /** One patch on several criteria at once (bulk triage), attributed once. */
    setTriageMany: (keys, patch) => set(prev => {
      const at = new Date(nowMs()).toISOString()
      const next = { ...prev.triage }
      for (const k of keys) next[k] = { ...(next[k] ?? {}), ...patch, setBy: prev.viewer, setAt: at }
      return { triage: next }
    }),
    reset: () => { try { window.localStorage.removeItem(KEY) } catch { /* ignore */ } setS({ ...DEFAULTS, shell: s.shell }) },
  }), [s, set])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)

/** The prototype's clock: NOW plus the time since the page opened, so new
    records read "1 minute ago" and keep ageing. */
const opened = Date.now()
export const nowMs = () => NOW + (Date.now() - opened)
