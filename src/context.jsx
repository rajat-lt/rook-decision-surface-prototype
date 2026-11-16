// The agent's context graph (Rajat, 16 Nov 2026, from a screenshot of the
// product's Context section): what the agent can call, each edge styled by
// whether the call can write. A definition graph, not a runtime trace: an
// edge means the agent can call that part (web UI doc, Versions and Call
// Graph). Zoom in, zoom out, reset and full screen, as the screenshot shows.
// No LT component draws graphs (gap G8), so this is an SVG composite.
import React, { useEffect, useRef, useState } from 'react'
import { Plus, Minus, RotateCcw, Maximize, Minimize } from 'lucide-react'
import { LTIconButton } from './lt.jsx'
import { CONTEXT } from './data.js'

const W = 1000, H = 330, NW = 200, NH = 56
const KIND = { agent: 'AGENT', mcp: 'MCP', database: 'DATABASE', service: 'SERVICE' }
// writes: danger; read only: the default ink; unknown: dashed, muted (the
// screenshot's legend; the web UI doc: "Dashed edges indicate unknown
// mutation status, not a safe operation").
const STYLE = {
  write: { cls: 'ctx-edge--write', marker: 'ctx-arrow-write', word: 'writes' },
  read: { cls: 'ctx-edge--read', marker: 'ctx-arrow-read', word: 'read only' },
  unknown: { cls: 'ctx-edge--unknown', marker: 'ctx-arrow-unknown', word: 'unknown' },
}
const access = c => (c.write === true ? 'write' : c.write === false ? 'read' : 'unknown')
const SCALES = [0.6, 0.8, 1, 1.25, 1.5, 2]

export function ContextMap({ version }) {
  const [si, setSi] = useState(2)
  const [full, setFull] = useState(false)
  const box = useRef(null)
  const reached = CONTEXT.nodes.filter(n => n.id !== CONTEXT.root).length
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  // A browser can refuse full screen (an embedding frame or a policy); the
  // graph then stays as it is, and the refusal is logged rather than thrown.
  const toggleFull = () => {
    const p = document.fullscreenElement ? document.exitFullscreen?.() : box.current?.requestFullscreen?.()
    p?.catch?.(e => console.warn('Full screen refused:', e.message))
  }
  const scale = SCALES[si]
  const describe = c => `${c.from} calls ${c.to} via ${c.via}: ${STYLE[access(c)].word}${c.tools.length ? ` (${c.tools.join(', ')})` : ''}`
  return (
    <figure className={`ctxmap${full ? ' is-full' : ''}`} ref={box} aria-labelledby="ctxmap-cap">
      <div className="ctxmap__stage">
        <div className="ctxmap__tools" role="toolbar" aria-label="Context graph view">
          <LTIconButton icon={Plus} ariaLabel="Zoom in" variant="outline" size="small" inactive={si === SCALES.length - 1} onClick={() => setSi(i => Math.min(SCALES.length - 1, i + 1))} />
          <LTIconButton icon={Minus} ariaLabel="Zoom out" variant="outline" size="small" inactive={si === 0} onClick={() => setSi(i => Math.max(0, i - 1))} />
          <LTIconButton icon={RotateCcw} ariaLabel="Reset zoom" variant="outline" size="small" onClick={() => setSi(2)} />
          <LTIconButton icon={full ? Minimize : Maximize} ariaLabel={full ? 'Exit full screen' : 'Enter full screen'} variant="outline" size="small" onClick={toggleFull} />
        </div>
        <div className="ctxmap__canvas">
        <svg className="ctxmap__svg" viewBox={`0 0 ${W} ${H}`} width={W * scale} height={H * scale} role="img" aria-labelledby="ctxmap-title ctxmap-desc">
          <title id="ctxmap-title">{CONTEXT.root} context graph</title>
          <desc id="ctxmap-desc">{CONTEXT.calls.map(describe).join('. ')}.</desc>
          <defs>
            {Object.entries(STYLE).map(([k, v]) => (
              <marker key={k} id={v.marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" className={`ctx-arrow ctx-arrow--${k}`} />
              </marker>
            ))}
          </defs>
          {CONTEXT.calls.map((c, i) => {
            const st = STYLE[access(c)]
            return (
              <g key={i} className={`ctx-edge ${st.cls}`}>
                <title>{describe(c)}</title>
                <polyline points={c.points.map(p => p.join(',')).join(' ')} markerEnd={`url(#${st.marker})`} />
                <text x={c.label[0]} y={c.label[1]} textAnchor="middle" className="ctx-edge__label">{c.via}</text>
              </g>
            )
          })}
          {CONTEXT.nodes.map(n => (
            <g key={n.id} className={`ctx-node ctx-node--${n.kind}${n.id === CONTEXT.root ? ' is-root' : ''}`}>
              <rect x={n.x} y={n.y} width={NW} height={NH} rx="8" />
              <text x={n.x + NW / 2} y={n.y + 24} textAnchor="middle" className="ctx-node__name">{n.id}</text>
              <text x={n.x + NW / 2} y={n.y + 42} textAnchor="middle" className="ctx-node__kind">{KIND[n.kind]}</text>
            </g>
          ))}
        </svg>
        </div>
      </div>
      <figcaption className="ctxmap__legend" id="ctxmap-cap">
        {Object.entries(STYLE).map(([k, v]) => (
          <span key={k} className="ctxmap__key"><svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" className={`ctx-key ctx-edge--${k}`} /></svg>{v.word}</span>
        ))}
        <span className="ctxmap__count">{reached} reached · {CONTEXT.calls.length} calls</span>
        <span className="vh">Calls declared in the {version} definition.</span>
      </figcaption>
    </figure>
  )
}
