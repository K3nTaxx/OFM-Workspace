import { AnimatePresence, motion } from "framer-motion"
import { CheckCircleIcon, CheckIcon, InfoIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useUI } from "../ui/UIProvider"

export function Toasts() {
  const { toasts } = useUI()
  return createPortal(
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            data-tone={t.tone}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <span className="toast-icon">
              {t.tone === "error" ? (
                <WarningCircleIcon size={17} weight="fill" />
              ) : t.tone === "info" ? (
                <InfoIcon size={17} weight="fill" />
              ) : (
                <CheckCircleIcon size={17} weight="fill" />
              )}
            </span>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

export function ContextMenu() {
  const { menu, closeMenu } = useUI()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null)
    const r = ref.current.getBoundingClientRect()
    setPos({
      left: Math.min(menu.x, window.innerWidth - r.width - 8),
      top: Math.min(menu.y, window.innerHeight - r.height - 8),
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => closeMenu()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu()
    window.addEventListener("pointerdown", close)
    window.addEventListener("blur", close)
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("pointerdown", close)
      window.removeEventListener("blur", close)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", close)
    }
  }, [menu, closeMenu])

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={ref}
          className="menu"
          role="menu"
          style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? "visible" : "hidden", transformOrigin: "0 0" }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.1 }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} className="menu-sep" />
            ) : item.heading ? (
              <div key={i} className="menu-label">
                {item.heading}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={`menu-item${item.danger ? " menu-item--danger" : ""}`}
                onClick={() => {
                  closeMenu()
                  item.onSelect?.()
                }}
              >
                {item.icon}
                {item.label}
                {item.checked && <CheckIcon className="menu-check" size={13} weight="bold" />}
                {item.shortcut && <span className="kbd">{item.shortcut}</span>}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Alerte de confirmation façon macOS (icône de l'app, titre, deux boutons). */
export function ConfirmDialog() {
  const { confirmState } = useUI()
  useEffect(() => {
    if (!confirmState) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") confirmState.resolve(false)
      if (e.key === "Enter") confirmState.resolve(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirmState])

  return createPortal(
    <AnimatePresence>
      {confirmState && (
        <motion.div
          className="sheet-backdrop"
          style={{ alignItems: "center", paddingTop: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            className="alert"
            role="alertdialog"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
          >
            <span className="alert-icon">
              <WarningCircleIcon size={34} weight="fill" />
            </span>
            <strong>{confirmState.title}</strong>
            {confirmState.message && <p>{confirmState.message}</p>}
            <div className="alert-actions">
              <button type="button" className="btn" onClick={() => confirmState.resolve(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={`btn ${confirmState.danger ? "btn--destructive" : "btn--primary"}`}
                autoFocus
                onClick={() => confirmState.resolve(true)}
              >
                {confirmState.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Feuille modale (style macOS) : fond assombri, panneau qui descend légèrement. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  width = 640,
  icon,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  icon?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal
            style={{ width }}
            initial={{ opacity: 0, y: -14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
          >
            <div className="sheet-head">
              {icon}
              <span className="sheet-title">{title}</span>
              <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Fermer">
                <XIcon size={15} />
              </button>
            </div>
            <div className="sheet-body">{children}</div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
