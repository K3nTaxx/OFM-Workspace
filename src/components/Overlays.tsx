import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion"
import { CheckCircleIcon, CheckIcon, InfoIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useLayer } from "../ui/layers"
import { useUI } from "../ui/UIProvider"
import { useIsMobile } from "../ui/useIsMobile"

/** Feuille du bas (téléphone) : on la tire vers le bas pour la fermer, comme sur iPhone. */
const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 40 } as const
const dismissed = (info: PanInfo) => info.offset.y > 120 || info.velocity.y > 650

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
  const mobile = useIsMobile()
  useLayer(!!menu, closeMenu)

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
    window.addEventListener("pointerdown", close)
    window.addEventListener("blur", close)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("pointerdown", close)
      window.removeEventListener("blur", close)
      window.removeEventListener("resize", close)
    }
  }, [menu, closeMenu])

  return createPortal(
    <AnimatePresence>
      {menu && mobile && (
        <motion.div
          key="fond"
          className="menu-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => {
            e.stopPropagation()
            closeMenu()
          }}
        />
      )}
      {menu && (
        <motion.div
          key="menu"
          ref={ref}
          className="menu"
          role="menu"
          style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? "visible" : "hidden", transformOrigin: "0 0" }}
          initial={mobile ? { opacity: 0, y: 40 } : { opacity: 0, scale: 0.97 }}
          animate={mobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
          exit={mobile ? { opacity: 0, y: 30, transition: { duration: 0.16 } } : { opacity: 0, transition: { duration: 0.08 } }}
          transition={mobile ? SHEET_SPRING : { duration: 0.1 }}
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
  // Entrée valide le bouton qui a le focus (Confirmer au départ, Annuler si on y est allé avec Tab)
  useLayer(!!confirmState, () => confirmState?.resolve(false))

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
            aria-modal
            aria-labelledby="alert-title"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
          >
            <span className="alert-icon">
              <WarningCircleIcon size={34} weight="fill" />
            </span>
            <strong id="alert-title">{confirmState.title}</strong>
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
  useLayer(open, onClose)
  const mobile = useIsMobile()
  const drag = useDragControls()

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
            {...(mobile
              ? {
                  initial: { y: "100%" },
                  animate: { y: 0 },
                  exit: { y: "100%", transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } },
                  transition: SHEET_SPRING,
                  drag: "y" as const,
                  dragControls: drag,
                  dragListener: false,
                  dragConstraints: { top: 0, bottom: 0 },
                  dragElastic: { top: 0, bottom: 0.7 },
                  onDragEnd: (_: unknown, info: PanInfo) => dismissed(info) && onClose(),
                }
              : {
                  initial: { opacity: 0, y: -14, scale: 0.985 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  exit: { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.14 } },
                  transition: { type: "spring", stiffness: 460, damping: 36 },
                })}
          >
            <div className="sheet-head" onPointerDown={(e) => mobile && drag.start(e)}>
              <span className="sheet-grabber" />
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
