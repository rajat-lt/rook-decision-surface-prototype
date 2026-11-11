// App state: the prototype bar's choices, the release policy, triage
// dispositions and decision records. Kept in this browser's local storage as
// a per-viewer convenience (spec §11); every read and write is guarded.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SEED_TRIAGE, SEED_DECISIONS, NOW } from './data.js'
import { STRICT } from './model.js'

const KEY = 'rook-decision-surface:v1'
const DEFAULTS = { proto: 'blocked', shell: 'platform', viewer: 'ritika', policy: STRICT, triage: SEED_TRIAGE, decisions: SEED_DECISIONS }

function load() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { return DEFAULTS }
}

const Ctx = createContext(null)
export function StoreProvider({ children }) {
  const [s, setS] = useState(load)
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ shell: s.shell, viewer: s.viewer, policy: s.policy, triage: s.triage, decisions: s.decisions })) } catch { /* storage blocked: state lives in memory */ }
  }, [s])
  const set = useCallback(patch => setS(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), [])
  const api = useMemo(() => ({
    ...s,
    // "Awaiting a policy" is a prototype state: it hides the policy without losing it.
    effectivePolicy: s.proto === 'no-policy' ? null : s.policy,
    set,
    setTriage: (key, patch) => set(prev => {
      const cur = prev.triage[key] ?? {}
      return { triage: { ...prev.triage, [key]: { ...cur, ...patch, setBy: prev.viewer, setAt: new Date(nowMs()).toISOString() } } }
    }),
    recordDecision: (version, d) => set(prev => ({
      decisions: { ...prev.decisions, [version]: [{ ...d, by: prev.viewer, at: new Date(nowMs()).toISOString() }, ...(prev.decisions[version] ?? [])] },
    })),
    reset: () => { try { window.localStorage.removeItem(KEY) } catch { /* ignore */ } setS({ ...DEFAULTS, shell: s.shell }) },
  }), [s, set])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)

/** The prototype's clock: NOW plus the time since the page opened, so new
    records read "1 minute ago" and keep ageing. */
const opened = Date.now()
export const nowMs = () => NOW + (Date.now() - opened)
