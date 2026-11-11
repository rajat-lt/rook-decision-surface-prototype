// Menus, tabs, segmented controls, dialogs, the drawer, toasts and the inline
// text input. Same rules as lt.jsx: real component names, documented props,
// token styling, and the matching guidelines/ file for behaviour.
import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, CircleCheck, CircleAlert, Info, ChevronDown } from 'lucide-react'
import { cx, placeFloating, visibleRect, LTTooltip, LTIconButton, LTButton, usePortalRoot } from './lt.jsx'

/* ---------- LTActionMenu ----------
   Quick actions or one selection (selectionVariant="single"). Every item has
   an icon or none does; the trailing slot holds shortcuts only; danger items
   use the danger treatment; an unavailable item stays focusable, inactive,
   with its reason written into the item (guidelines/ltactionmenu.md).
   Keyboard: arrows, Home, End, Enter, Space, Esc, Tab.
   Documented props: customAnchor, activeId, selectionVariant, width, open,
   onMenuToggle (story-verified). `options` is TBD upstream (passthrough
   stories), so its item shape here, with onSelect and ariaLabel, stands in
   for it, and `align` only places the overlay.
   v7 (the Network tab's settings): an item with `checked` is a toggle
   (menuitemcheckbox) whose tick shows while it is on, beside the others'
   icons in the same leading column (C57); `trailing` without keyboard
   shortcuts is a value, read out with the label ("500ms"); `hint` gives
   screen readers an inactive item's reason when it shows no description
   (C59). */
export function LTActionMenu({ customAnchor, options, onSelect, selectionVariant = '', activeId, width = 240,
  align = 'end', ariaLabel, open: controlledOpen, onMenuToggle }) {
  const [openState, setOpenState] = useState(false)
  const open = controlledOpen ?? openState
  const setOpen = v => { setOpenState(v); onMenuToggle?.(v) }
  const [pos, setPos] = useState(null)
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const itemsRef = useRef([])
  const id = useId()
  const root = usePortalRoot()
  const items = options.filter(o => !o.divider)

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !anchorRef.current) return
    const update = () => setPos(placeFloating(anchorRef.current, menuRef.current, { side: 'bottom', align, offset: 4 }))
    update()
    // Focus now, not in an animation frame: frames stall while the window is
    // not painting.
    const sel = selectionVariant === 'single' ? items.findIndex(o => o.value === activeId) : 0
    itemsRef.current[Math.max(0, sel)]?.focus({ preventScroll: true })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = e => {
      if (!menuRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const close = (refocus = true) => { setOpen(false); if (refocus) anchorRef.current?.focus() }
  const choose = o => { if (o.inactive) return; close(); onSelect?.(o) }
  const onKeyDown = e => {
    const list = itemsRef.current.filter(Boolean)
    const i = list.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }

  const trigger = React.cloneElement(customAnchor, {
    ref: anchorRef,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: () => setOpen(!open),
    onKeyDown: e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } },
  })

  let n = -1
  return (
    <>
      {trigger}
      {open && createPortal(
        <div ref={menuRef} id={id} role="menu" aria-label={ariaLabel} className="lt-menu"
          style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} onKeyDown={onKeyDown}>
          {options.map((o, k) => {
            if (o.divider) return <div key={`d${k}`} role="separator" className="lt-menu__divider" />
            n += 1
            const idx = n
            const toggle = o.checked !== undefined
            const checked = selectionVariant === 'single' ? o.value === activeId : toggle ? !!o.checked : undefined
            const Icon = o.icon
            return (
              <button key={o.value ?? o.label} type="button" tabIndex={-1}
                ref={el => { itemsRef.current[idx] = el }}
                role={selectionVariant === 'single' ? 'menuitemradio' : toggle ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={checked}
                aria-keyshortcuts={o.keyshortcuts}
                aria-disabled={o.inactive || undefined}
                className={cx('lt-menu__item', o.variant === 'danger' && 'is-danger', o.inactive && 'is-inactive',
                  o.description && 'has-description')}
                onClick={() => choose(o)}>
                {selectionVariant === 'single' || toggle
                  ? <span className="lt-menu__check" aria-hidden="true">{checked && <Check size={16} />}</span>
                  : Icon && <Icon size={16} aria-hidden="true" className="lt-menu__icon" />}
                <span className="lt-menu__text">
                  <span className="lt-menu__label">{o.label}</span>
                  {o.description && <span className="lt-menu__desc">{o.description}</span>}
                  {o.hint && <span className="vh">{`, ${o.hint}`}</span>}
                </span>
                {o.trailing && (o.keyshortcuts
                  ? <span className="lt-menu__trail" aria-hidden="true">{o.trailing}</span>
                  : <span className="lt-menu__trail"><span className="vh">, </span>{o.trailing}</span>)}
              </button>
            )
          })}
        </div>, root)}
    </>
  )
}

/* ---------- LTSegmentedControl ----------
   Treated as a set of buttons, no role (guidelines/ltsegmentedcontrol.md);
   icon-only segments always carry a tooltip. */
export function LTSegmentedControl({ options, selectedValue, onChange, ariaLabel, isIconButton = false, variant = 'medium', className }) {
  return (
    <div role="group" aria-label={ariaLabel} className={cx('lt-seg', `lt-seg--${variant}`, isIconButton && 'lt-seg--icons', className)}>
      {options.map(o => {
        const on = o.value === selectedValue
        const btn = (
          <button key={o.value} type="button" aria-pressed={on} aria-label={isIconButton ? o.label : undefined}
            className={cx('lt-seg__btn', on && 'is-selected')} onClick={() => onChange(o.value)}>
            {isIconButton ? <o.icon size={16} aria-hidden="true" /> : o.label}
          </button>
        )
        return isIconButton ? <LTTooltip key={o.value} text={o.label} direction="bottom">{btn}</LTTooltip> : btn
      })}
    </div>
  )
}

/* ---------- LTUnderlineNav ----------
   The page's main tabs. Each tab has its own URL (guidelines/ltunderlinenav.md);
   the counter counts the rows in the tab (ux-text-guidelines.md §7). Native
   link dragging is off so a tab can be dragged to reorder it (v2 item 1,
   composed around the nav in tabbar.jsx); `onKeyDown` is the documented prop. */
export function LTUnderlineNav({ navs, current, ariaLabel, trailing, onKeyDown }) {
  return (
    <div className="lt-unav">
      <nav aria-label={ariaLabel}>
        <ul>
          {navs.map(t => (
            <li key={t.id} data-tab={t.id}>
              <a href={t.href} aria-current={t.id === current ? 'page' : undefined} draggable={false}
                onKeyDown={onKeyDown}
                className={cx('lt-unav__item', t.id === current && 'is-current')}>
                <span className="lt-unav__label" data-text={t.label}>{t.label}</span>
                {t.counter != null && <span className="lt-counter lt-counter--secondary">{t.counter}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {trailing && <div className="lt-unav__trailing">{trailing}</div>}
    </div>
  )
}

/* ---------- LTTabNav ----------
   The second tab layer, always below the page's LTUnderlineNav
   (guidelines/README.md §5). Boxed tabs on a hairline, the current one
   raised white, as in the notification-center and project-listing
   prototypes. Documented props: items (shape TBD → lttabnav--tab-nav),
   activeTab, ariaLabel, size, onSelect. Here it switches a request's
   details in place (v5 item 4), so its tabs are buttons with tab semantics
   and arrow keys, not links (automation-details.md §9). `idPrefix` ties
   each tab to the panel it controls. */
export function LTTabNav({ items, activeTab, ariaLabel, size = 'medium', onSelect, idPrefix }) {
  const refs = useRef([])
  const onKeyDown = (e, i) => {
    const j = e.key === 'ArrowRight' ? (i + 1) % items.length : e.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (j == null) return
    e.preventDefault()
    refs.current[j]?.focus()
    onSelect?.(items[j].id)
  }
  return (
    <div className={cx('lt-tabnav', `lt-tabnav--${size}`)} role="tablist" aria-label={ariaLabel}>
      {items.map((t, i) => {
        const on = t.id === activeTab
        return (
          <button key={t.id} ref={el => { refs.current[i] = el }} type="button" role="tab" id={`${idPrefix}-tab-${t.id}`}
            aria-selected={on} aria-controls={`${idPrefix}-panel`} tabIndex={on ? 0 : -1}
            className={cx('lt-tabnav__item', on && 'is-current')} onClick={() => onSelect?.(t.id)} onKeyDown={e => onKeyDown(e, i)}>
            <span className="lt-unav__label" data-text={t.label}>{t.label}</span>
            {t.counter != null && <span className="lt-counter lt-counter--secondary">{t.counter}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- focus trap shared by LTModal and LTDrawer ---------- */
function useDialog(isOpen, onClose, ref, initialRef) {
  useEffect(() => {
    if (!isOpen) return
    const prev = document.activeElement
    const focusables = () => [...ref.current.querySelectorAll(
      'button:not([aria-disabled="true"]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')]
    // Focus at once: animation frames stall while the window is not painting.
    ;(initialRef?.current ?? focusables()[0])?.focus()
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [isOpen])
}

/* ---------- LTModal ----------
   Widths 320 / 480 / 640 / 960 through extraStyle (guidelines/ltmodal.md).
   The backdrop closes it unless the body holds unsaved input
   (patterns/modal.md delta 3). */
export function LTModal({ isOpen, title, subTitle, onClose, children, renderFooter, extraStyle, initialRef, keepOnBackdrop = false }) {
  const ref = useRef(null)
  const id = useId()
  const root = usePortalRoot()
  useDialog(isOpen, onClose, ref, initialRef)
  if (!isOpen) return null
  return createPortal(
    <div className="lt-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !keepOnBackdrop) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="lt-modal" style={extraStyle}>
        <div className="lt-modal__head">
          <div>
            <h2 id={`${id}-t`} className="lt-modal__title">{title}</h2>
            {subTitle && <p className="lt-modal__sub">{subTitle}</p>}
          </div>
          <LTIconButton icon={X} ariaLabel="Close" variant="invisible" onClick={onClose} />
        </div>
        <div className="lt-modal__body">{children}</div>
        {renderFooter && <div className="lt-modal__foot">{renderFooter()}</div>}
      </div>
    </div>, root)
}

/* ---------- LTDrawer ---------- right side only (guidelines/ltmodal.md).
   Documented props used: title, subTitle, onClose, width, footerContent,
   showFooter, customHeader. `isOpen` replaces the imperative openDrawer()
   the story uses (spec §7.1). Widths 320 / 480 / 640 / 960 / 1120. */
export function LTDrawer({ isOpen, title, subTitle, onClose, width = 480, children, footerContent, showFooter = !!footerContent, customHeader }) {
  const ref = useRef(null)
  const id = useId()
  const root = usePortalRoot()
  useDialog(isOpen, onClose, ref)
  if (!isOpen) return null
  return createPortal(
    <div className="lt-backdrop lt-backdrop--drawer" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="lt-drawer" style={{ width }}>
        <div className="lt-drawer__head">
          <div className="lt-drawer__titles">
            <h2 id={`${id}-t`} className="lt-drawer__title">{title}</h2>
            {subTitle && <p className="lt-drawer__sub">{subTitle}</p>}
            {customHeader}
          </div>
          <LTIconButton icon={X} ariaLabel="Close" variant="invisible" onClick={onClose} />
        </div>
        <div className="lt-drawer__body">{children}</div>
        {showFooter && <div className="lt-drawer__foot">{footerContent}</div>}
      </div>
    </div>, root)
}

/* ---------- LTToast ---------- top right, 4 seconds (guidelines/README.md §7).
   An optional action (the "With Secondary Action" story), such as Undo
   (ux-text-guidelines.md §3 Toasts). A toast holds while the pointer or focus
   is on it, so its action can be reached in time. */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const timers = useRef(new Map())
  const root = usePortalRoot()
  const remove = useCallback(id => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    setList(l => l.filter(t => t.id !== id))
  }, [])
  const arm = useCallback(id => {
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => remove(id), 4000))
  }, [remove])
  const push = useCallback((text, variant = 'default', action = null) => {
    const id = Math.random().toString(36).slice(2)
    setList(l => [...l.slice(-2), { id, text, variant, action }])
    arm(id)
  }, [arm])
  const hold = id => clearTimeout(timers.current.get(id))
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="lt-toasts" role="status" aria-live="polite">
          {list.map(t => {
            const Icon = t.variant === 'success' ? CircleCheck : t.variant === 'danger' ? CircleAlert : Info
            return (
              <div key={t.id} className={cx('lt-toast', `lt-toast--${t.variant}`)}
                onMouseEnter={() => hold(t.id)} onMouseLeave={() => arm(t.id)}
                onFocus={() => hold(t.id)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) arm(t.id) }}>
                <Icon size={16} aria-hidden="true" className="lt-toast__icon" />
                <span>{t.text}</span>
                {t.action && (
                  <button type="button" className="lt-toast__action"
                    onClick={() => { remove(t.id); t.action.onClick() }}>{t.action.label}</button>
                )}
                <button type="button" className="lt-toast__close" aria-label="Dismiss"
                  onClick={() => remove(t.id)}><X size={14} aria-hidden="true" /></button>
              </div>
            )
          })}
        </div>, root)}
    </ToastCtx.Provider>
  )
}

/* ---------- LTPopover ----------
   Props from COMPONENTS.md: heading, text, popOverbodyJSX, direction,
   canChangeDirection, openOnClick (false: it opens on hover, as the
   component's own "Popover" story does), forceClose, onOpen, contentStyles,
   containsInteractiveChildElement.
   Brief v2 item 8 puts errors in it on hover; guidelines/ltpopover.md says
   never for errors (conflict C20).
   With containsInteractiveChildElement (v3 item 4) it holds actions and text
   to copy, so it behaves as ltpopover.md asks: a visible close button, Esc
   and click-outside. It opens after a short hover (so a pointer passing over
   the bar does not open it), then stays open after the pointer leaves the
   strip, until one of those closes it or another popover opens. Only one is
   ever open (ltpopover.md: never stack popovers).
   `place(anchor, popover)` (v6 item 8) replaces the placement: the Network
   tab puts its popovers above or below a table row, and keeps them in the
   viewport. It returns { top, left, side, caretX }. Not a library prop
   (automation-details.md §9). Moving from one anchor to another swaps the
   popovers in one render, so nothing blinks between them.
   `headerActions` (v7 item 11) puts buttons in the head, left of the close
   button; the component documents no such slot (§9), so it stands in. */
let currentPopover = null // the close function of the popover open now
/** Closes whichever popover is open: the Network tab's, when the rows under it move (v6). */
export const closePopover = () => currentPopover?.current()

export function LTPopover({ children, heading, text, popOverbodyJSX, direction = 'top', canChangeDirection = false,
  openOnClick = false, forceClose = false, onOpen, contentStyles, containsInteractiveChildElement = false, place, className,
  openDelay, headerActions }) {
  const interactive = containsInteractiveChildElement
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const anchorRef = useRef(null)
  const popRef = useRef(null)
  const timer = useRef(0)
  const closeRef = useRef(null)
  const headingId = useId()
  const root = usePortalRoot()
  const side = direction.split('-')[0]
  // top-left / top-right and right-top / right-bottom: the box's start or end.
  const align = { left: 'start', right: 'end', top: 'start', bottom: 'end' }[direction.split('-')[1]] ?? 'center'

  // Taking over from another open popover, this one shows at once, without
  // the fade-in, so the swap reads as one popover moving (v6 item 8).
  const [instant, setInstant] = useState(false)
  closeRef.current = () => setOpen(false)
  const show = () => {
    const swap = !!currentPopover && currentPopover !== closeRef
    if (swap) currentPopover.current()
    currentPopover = closeRef
    setInstant(swap)
    setOpen(true)
  }
  useEffect(() => { if (!open && currentPopover === closeRef) currentPopover = null }, [open])
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (currentPopover === closeRef) currentPopover = null
  }, [])
  useEffect(() => { if (forceClose) setOpen(false) }, [forceClose])
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popRef.current) return
    const update = e => {
      if (!anchorRef.current || !popRef.current) return
      // An interactive popover closes when the list holding its strip
      // scrolls, rather than float away from it.
      if (interactive && e?.type === 'scroll' && e.target !== document && e.target.contains?.(anchorRef.current)) {
        setOpen(false)
        return
      }
      if (place) {
        const p = place(anchorRef.current, popRef.current)
        if (p) { setPos(p); return }
      }
      // Placed beside the part of the anchor in view (v5: a Waterfall cell
      // half cut off by the table's sideways scroll).
      const a = visibleRect(anchorRef.current)
      const p = placeFloating({ getBoundingClientRect: () => a }, popRef.current, { side, align, offset: 10, flip: canChangeDirection })
      const w = popRef.current.offsetWidth, h = popRef.current.offsetHeight
      // The caret points at the anchor's centre, however the box was clamped.
      p.caretX = Math.min(w - 16, Math.max(16, a.left + a.width / 2 - p.left))
      p.caretY = Math.min(h - 16, Math.max(16, a.top + a.height / 2 - p.top))
      setPos(p)
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open, side, align])
  useEffect(() => {
    if (!open) return
    onOpen?.()
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    // Click-outside, for the interactive kind (ltpopover.md).
    const onDown = e => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    if (interactive) document.addEventListener('pointerdown', onDown, true)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown, true) }
  }, [open])

  const child = React.Children.only(children)
  const hover = openOnClick ? {} : interactive ? {
    onMouseEnter: e => { child.props.onMouseEnter?.(e); clearTimeout(timer.current); if (!open) timer.current = setTimeout(show, openDelay ?? 250) },
    onMouseLeave: e => { child.props.onMouseLeave?.(e); clearTimeout(timer.current) },
  } : {
    onMouseEnter: e => { child.props.onMouseEnter?.(e); clearTimeout(timer.current); timer.current = setTimeout(show, openDelay ?? 150) },
    onMouseLeave: e => { child.props.onMouseLeave?.(e); clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 80) },
    onPointerDown: e => { child.props.onPointerDown?.(e); clearTimeout(timer.current); setOpen(false) },
  }
  const click = openOnClick ? { onClick: e => { child.props.onClick?.(e); open ? setOpen(false) : show() } } : {}
  const trigger = React.cloneElement(child, {
    ref: node => {
      anchorRef.current = node
      const r = child.props.ref
      if (typeof r === 'function') r(node); else if (r) r.current = node
    },
    ...hover, ...click,
  })
  const style = {
    top: pos?.top ?? -9999, left: pos?.left ?? -9999, '--caret-x': `${pos?.caretX ?? 16}px`,
    '--caret-y': `${pos?.caretY ?? 16}px`, ...contentStyles,
  }
  return (
    <>
      {trigger}
      {open && createPortal(interactive ? (
        <div ref={popRef} role="dialog" aria-labelledby={heading ? headingId : undefined}
          className={cx('lt-popover', 'is-interactive', pos && `is-${pos.side}`, instant && 'is-instant', className)} style={style}>
          <div className="lt-popover__head">
            {heading && <p id={headingId} className="lt-popover__heading">{heading}</p>}
            <span className="lt-popover__actions">
              {headerActions}
              <LTIconButton icon={X} ariaLabel="Close" variant="invisible" size="xsmall" tooltipDirection="n"
                className="lt-popover__close" onClick={() => setOpen(false)} />
            </span>
          </div>
          {text && <p className="lt-popover__text">{text}</p>}
          {popOverbodyJSX}
        </div>
      ) : (
        <div ref={popRef} className={cx('lt-popover', pos && `is-${pos.side}`, instant && 'is-instant', className)} aria-hidden="true" style={style}>
          {heading && <p className="lt-popover__heading">{heading}</p>}
          {text && <p className="lt-popover__text">{text}</p>}
          {popOverbodyJSX}
        </div>
      ), root)}
    </>
  )
}

/* ---------- LTInlineTextInput ----------
   An input that reads as text until hovered (border) or focused (border and
   ring). Enter or blur saves, Esc restores, an empty value is refused with a
   field error that leads with the fix. showEditTooltip is off here:
   guidelines/lttooltip.md bars tooltips on form fields, and the brief's
   screenshot 2 shows none. */
export function LTInlineTextInput({ value, onCommit, ariaLabel, size = 'medium', className, maxLength = 255,
  validationMessage = 'Enter a value.', loading = false, onHoverChange }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)
  const inputRef = useRef(null)
  const sizerRef = useRef(null)
  const cancelled = useRef(false)
  const msgId = useId()
  useEffect(() => { setDraft(value); setError(false) }, [value])
  useLayoutEffect(() => { if (sizerRef.current) setWidth(sizerRef.current.offsetWidth) }, [draft])

  const commit = () => {
    if (cancelled.current) { cancelled.current = false; return }
    const v = draft.trim()
    if (!v) { setError(true); requestAnimationFrame(() => inputRef.current?.focus()); return }
    setError(false)
    if (v !== value) onCommit(v)
    else setDraft(value)
  }
  return (
    <span className={cx('lt-inline', `lt-inline--${size}`, error && 'is-error', loading && 'is-loading', className)}
      onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)}>
      <span ref={sizerRef} className="lt-inline__sizer" aria-hidden="true">{draft || ' '}</span>
      <input ref={inputRef} value={draft} maxLength={maxLength} aria-label={ariaLabel}
        aria-invalid={error || undefined} aria-describedby={error ? msgId : undefined}
        style={{ width: width ? width + 18 : undefined }}
        onFocus={e => e.target.select()}
        onChange={e => { setDraft(e.target.value); if (error && e.target.value.trim()) setError(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelled.current = true; setDraft(value); setError(false); e.currentTarget.blur() }
        }}
        onBlur={commit} />
      {error && <span id={msgId} className="lt-inline__error" role="alert">{validationMessage}</span>}
    </span>
  )
}

/* ---------- LTSelect ----------
   New here (spec §3.1, gap G2). Documented props used: leadingText,
   customButtonText, options (shape TBD → ltselect--select), onChange,
   inputAriaLabel, anchorButtonSize, disabled. Single selection only. The
   anchor reads "{leadingText}: {value}" with a caret; the list is the
   LTActionMenu overlay with single selection, so the keyboard model is the
   menu's. `value` (the selected option) and `align` are not documented. */
export function LTSelect({ leadingText, customButtonText, options, value, onChange, inputAriaLabel, anchorButtonSize = 'medium',
  disabled = false, align = 'start', width = 280, className, variant = 'outline', id }) {
  const current = options.find(o => o.value === value)
  const text = customButtonText ?? current?.label ?? ''
  return (
    <LTActionMenu
      customAnchor={
        <LTButton id={id} variant={variant} size={anchorButtonSize} inactive={disabled} trailingIcon={ChevronDown}
          ariaLabel={inputAriaLabel ? `${inputAriaLabel}: ${text}` : undefined} className={cx('lt-select', className)}>
          {leadingText ? <><span className="lt-select__lead">{leadingText}</span>{text}</> : text}
        </LTButton>
      }
      options={options} selectionVariant="single" activeId={value} width={width} align={align}
      ariaLabel={inputAriaLabel ?? leadingText} onSelect={o => onChange?.(o.value)} />
  )
}

export { LTButton }
