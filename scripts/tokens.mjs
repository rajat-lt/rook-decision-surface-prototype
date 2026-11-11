// Generates src/tokens.css from design-context's data/tokens.json.
//
// Reads the file from design-context's `main` branch (the canonical copy), not
// from the working tree, so a checkout parked on another branch cannot leak in.
// Every CSS variable carries the token path it came from. Nothing here is a
// hand-picked colour: a value either resolves from tokens.json or the script
// stops with an error.
//
//   DESIGN_CONTEXT=/path/to/design-context npm run tokens
//
// Default path: ../design-context (the sibling checkout in the lambdatest folder).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dc = resolve(process.env.DESIGN_CONTEXT ?? resolve(here, '../../design-context'))
const git = args => execFileSync('git', ['-C', dc, ...args], { encoding: 'utf8' })
const tokens = JSON.parse(git(['show', 'main:data/tokens.json']))
const commit = git(['rev-parse', '--short', 'main']).trim()

// `var(--a, var(--b, #fff))` → `#fff`. Primer ships CSS-variable chains with the
// literal as the last fallback; the literal is the light-theme value.
function literal(value) {
  let v = String(value).trim()
  while (v.startsWith('var(')) {
    let depth = 0, comma = -1
    for (let i = 4; i < v.length; i++) {
      const c = v[i]
      if (c === '(') depth++
      else if (c === ')') { if (depth === 0) break; depth-- }
      else if (c === ',' && depth === 0) { comma = i; break }
    }
    if (comma < 0) throw new Error(`No fallback in ${value}`)
    v = v.slice(comma + 1, v.lastIndexOf(')')).trim()
  }
  return v
}

function at(path) {
  const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), tokens)
  if (v === undefined || typeof v === 'object') throw new Error(`Missing token: ${path}`)
  return literal(v)
}

const L = 'colorSchemes.light.colors.'
const D = 'colorSchemes.dark.colors.'

// [css variable, token path]
const MAP = [
  ['/* Foreground */'],
  ['--fg-default', L + 'fg.default'],
  ['--fg-muted', L + 'fg.muted'],
  ['--fg-subtle', L + 'fg.subtle'],
  ['--fg-disabled', L + 'fg.disabled'],
  ['--fg-on-emphasis', L + 'fg.onEmphasis'],
  ['--fg-accent', L + 'fg.accent'],
  ['/* Canvas and backgrounds */'],
  ['--canvas-default', L + 'canvas.default'],
  ['--canvas-subtle', L + 'canvas.subtle'],
  ['--canvas-overlay', L + 'canvas.overlay'],
  ['--bg-muted', L + 'bg.muted'],
  ['--bg-neutral-subtle', L + 'bg.neutralSubtle'],
  ['--bg-neutral-emphasis', L + 'bg.neutralEmphasis'],
  ['--bg-selected', L + 'bg.selected'],
  ['--neutral-muted', L + 'neutral.muted'],
  ['--neutral-subtle', L + 'neutral.subtle'],
  ['--neutral-emphasis-plus', L + 'neutral.emphasisPlus'],
  ['--on-hover', L + 'onHover'],
  ['--on-selected', L + 'onSelected'],
  ['/* Borders */'],
  ['--border-default', L + 'border.default'],
  ['--border-secondary', L + 'border.secondary'],
  ['--border-muted', L + 'border.muted'],
  ['--border-light-gray', L + 'border.lightGray'],
  ['--border-subtle', L + 'border.subtle'],
  ['/* Accent */'],
  ['--accent-fg', L + 'accent.fg'],
  ['--accent-emphasis', L + 'accent.emphasis'],
  ['--accent-subtle', L + 'accent.subtle'],
  ['--accent-border-muted', L + 'border.accentMuted'],
  ['--link', L + 'link.default'],
  ['--focus-outline', L + 'focus.outlineColor'],
  ['/* LT orange: selection bar and the active tab underline */'],
  ['--highlight', L + 'highlight'],
  ['/* Semantic */'],
  ['--success-fg', L + 'success.fg'],
  ['--success-emphasis', L + 'success.emphasis'],
  ['--success-subtle', L + 'success.subtle'],
  ['--danger-fg', L + 'danger.fg'],
  ['--danger-emphasis', L + 'danger.emphasis'],
  ['--danger-subtle', L + 'danger.subtle'],
  ['--danger-muted', L + 'danger.muted'],
  ['--attention-fg', L + 'attention.fg'],
  ['--attention-emphasis', L + 'attention.emphasis'],
  ['--attention-subtle', L + 'attention.subtle'],
  ['--attention-muted', L + 'attention.muted'],
  ['--accent-muted', L + 'accent.muted'],
  ['--neutral-emphasis', L + 'neutral.emphasis'],
  ['--done-subtle', L + 'done.subtle'],
  ['--severe-subtle', L + 'severe.subtle'],
  ['--severe-fg', L + 'severe.fg'],
  ['--severe-emphasis', L + 'severe.emphasis'],
  ['--done-fg', L + 'done.fg'],
  ['--done-emphasis', L + 'done.emphasis'],
  ['--success-muted', L + 'success.muted'],
  ['/* Buttons */'],
  ['--btn-text', L + 'btn.text'],
  ['--btn-bg', L + 'btn.bg'],
  ['--btn-border', L + 'btn.border'],
  ['--btn-hover-bg', L + 'btn.hoverBg'],
  ['--btn-active-bg', L + 'btn.activeBg'],
  ['--btn-counter-bg', L + 'btn.counterBg'],
  ['--btn-outline-bg', L + 'btn.outline.bg'],
  ['--btn-outline-border', L + 'btn.outline.border'],
  ['--btn-outline-text', L + 'btn.outline.text'],
  ['--btn-outline-selected-bg', L + 'btn.outline.selectedBg'],
  ['--btn-invisible-hover-bg', L + 'btn.invisible.hoverBg'],
  ['--btn-invisible-active-bg', L + 'btn.invisible.activeBg'],
  ['--btn-danger-bg', L + 'btn.danger.bg'],
  ['--btn-danger-border', L + 'btn.danger.border'],
  ['--btn-danger-text', L + 'btn.danger.text'],
  ['--btn-danger-hover-bg', L + 'btn.danger.hoverBg'],
  ['--btn-danger-hover-text', L + 'btn.danger.hoverText'],
  ['--btn-primary-bg', L + 'btn.primary.bg'],
  ['--btn-primary-hover-bg', L + 'btn.primary.hoverBg'],
  ['--btn-primary-text', L + 'btn.primary.text'],
  ['--btn-inactive-bg', L + 'btn.inactive.bg'],
  ['--btn-inactive-text', L + 'btn.inactive.text'],
  ['/* Menus, lists, segmented control, counters */'],
  ['--list-hover-bg', L + 'actionListItem.default.hoverBg'],
  ['--list-active-bg', L + 'actionListItem.default.activeBg'],
  ['--list-danger-hover-bg', L + 'actionListItem.danger.hoverBg'],
  ['--list-inline-divider', L + 'actionListItem.inlineDivider'],
  ['--seg-bg', L + 'segmentedControl.bg'],
  ['--seg-button-bg', L + 'segmentedControl.button.bg'],
  ['--seg-button-hover-bg', L + 'segmentedControl.button.hover.bg'],
  ['--seg-selected-border', L + 'segmentedControl.button.selected.border'],
  ['--overlay-backdrop', L + 'primer.canvas.backdrop'],
  ['/* Code and log surfaces: own theme, dark by default (guidelines/README.md §1) */'],
  ['--log-bg', L + 'checks.bg'],
  ['--log-raised', L + 'checks.inputBg'],
  ['--log-border', L + 'checks.headerBorder'],
  ['--log-text', L + 'checks.lineText'],
  ['--log-text-strong', L + 'checks.textPrimary'],
  ['--log-text-muted', L + 'checks.lineTimestampText'],
  ['--log-num', L + 'checks.lineNumText'],
  ['--log-btn-icon', L + 'checks.btnIcon'],
  ['--log-btn-hover-bg', L + 'checks.btnHoverBg'],
  ['--log-input-text', L + 'checks.inputText'],
  ['--syntax-dark-string', D + 'prettylights.syntax.string'],
  ['--syntax-dark-constant', D + 'prettylights.syntax.constant'],
  ['--syntax-dark-entity', D + 'prettylights.syntax.entity'],
  ['--syntax-dark-keyword', D + 'prettylights.syntax.keyword'],
  ['--syntax-light-string', L + 'prettylights.syntax.string'],
  ['--syntax-light-constant', L + 'prettylights.syntax.constant'],
  ['--syntax-light-entity', L + 'prettylights.syntax.entity'],
  ['--syntax-light-keyword', L + 'prettylights.syntax.keyword'],
  ['/* Shadows */'],
  ['--shadow-overlay', 'shadows.overlay.shadow'],
  ['--shadow-large', 'shadows.shadow.large'],
  ['--shadow-medium', 'shadows.shadow.medium'],
  ['--shadow-small', 'shadows.shadow.small'],
  ['--shadow-btn', 'shadows.btn.shadow'],
  ['/* Type */'],
  ['--font-sans', 'fonts.normal'],
  ['--font-mono', 'fonts.mono'],
  ['--font-12', 'fontSizes.0'],
  ['--font-14', 'fontSizes.1'],
  ['--font-16', 'fontSizes.2'],
  ['--font-20', 'fontSizes.3'],
  ['--weight-regular', 'fontWeights.normal'],
  ['--weight-semibold', 'fontWeights.semibold'],
  ['--weight-bold', 'fontWeights.bold'],
  ['/* Space, radii, motion */'],
  ['--space-1', 'space.1'],
  ['--space-2', 'space.2'],
  ['--space-4', 'space.3'],
  ['--space-6', 'space.4'],
  ['--space-8', 'space.5'],
  ['--space-10', 'space.6'],
  ['--space-12', 'space.7'],
  ['--space-28', 'space.11'],
  ['--radius-1', 'radii.1'],
  ['--radius-2', 'radii.2'],
  ['--radius-pill', 'radii.3'],
  ['--ease-out', 'animation.easeOutCubic'],
]

const lines = []
for (const [name, path] of MAP) {
  if (!path) { lines.push(`\n  ${name}`); continue }
  lines.push(`  ${name}: ${at(path)}; /* ${path} */`)
}

const css = `/* GENERATED by scripts/tokens.mjs from design-context data/tokens.json
   (main @ ${commit}). Do not edit by hand: change the map in the script and
   re-run \`npm run tokens\`. Light theme only, per guidelines/README.md §1. */
:root {${lines.join('\n')}

  /* Derived, not new values. The space token scale skips 12 and 20; the
     guidelines allow every multiple of 4 (guidelines/README.md §2). */
  --space-3: calc(var(--space-1) * 3);
  --space-5: calc(var(--space-1) * 5);

  /* The type scale from guidelines/README.md §3 (line heights are stated
     there, not in tokens.json). */
  --lh-12: 18px;
  --lh-14: 20px;
  --lh-16: 24px;
  --lh-20: 32px;
  --track-title-medium: -1.2px;
}
`
writeFileSync(resolve(here, '../src/tokens.css'), css)
console.log(`src/tokens.css written from design-context main @ ${commit}: ${MAP.filter(m => m[1]).length} tokens`)
