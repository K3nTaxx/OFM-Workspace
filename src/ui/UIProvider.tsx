import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export interface ToastItem {
  id: number
  text: string
  tone: "success" | "error" | "info"
}

export interface MenuEntry {
  label?: string
  icon?: ReactNode
  shortcut?: string
  danger?: boolean
  checked?: boolean
  separator?: boolean
  heading?: string
  onSelect?: () => void
}

export interface MenuState {
  x: number
  y: number
  items: MenuEntry[]
}

export interface NewCallPreset {
  date?: string
}

export interface NewDocPreset {
  categoryId?: string | null
  callId?: string | null
  files?: File[]
}

interface UIValue {
  toasts: ToastItem[]
  toast: (text: string, tone?: ToastItem["tone"]) => void
  menu: MenuState | null
  openMenu: (e: { clientX: number; clientY: number } | { x: number; y: number }, items: MenuEntry[]) => void
  closeMenu: () => void
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  newCall: NewCallPreset | null
  openNewCall: (preset?: NewCallPreset) => void
  closeNewCall: () => void
  newDoc: NewDocPreset | null
  openNewDoc: (preset?: NewDocPreset) => void
  closeNewDoc: () => void
  previewDocId: string | null
  setPreviewDocId: (id: string | null) => void
  confirmState: ConfirmState | null
  confirm: (opts: Omit<ConfirmState, "resolve">) => Promise<boolean>
}

export interface ConfirmState {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

const UIContext = createContext<UIValue | null>(null)

let toastId = 0

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newCall, setNewCall] = useState<NewCallPreset | null>(null)
  const [newDoc, setNewDoc] = useState<NewDocPreset | null>(null)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const confirm = useCallback<UIValue["confirm"]>(
    (opts) =>
      new Promise<boolean>((resolve) =>
        setConfirmState({
          ...opts,
          resolve: (ok) => {
            setConfirmState(null)
            resolve(ok)
          },
        }),
      ),
    [],
  )

  const toast = useCallback((text: string, tone: ToastItem["tone"] = "success") => {
    const id = ++toastId
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  // Filet de sécurité : une action qui échoue sans être gérée (réseau coupé, session expirée…) le dit au lieu de se taire
  useEffect(() => {
    const onFail = (e: PromiseRejectionEvent) => {
      console.error(e.reason)
      toast("Une action n'a pas abouti. Vérifie ta connexion puis réessaie.", "error")
    }
    window.addEventListener("unhandledrejection", onFail)
    return () => window.removeEventListener("unhandledrejection", onFail)
  }, [toast])

  // Un fichier lâché à côté d'une zone de dépôt ne doit pas faire quitter le logiciel (le navigateur l'ouvrirait)
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault()
    }
    window.addEventListener("dragover", block)
    window.addEventListener("drop", block)
    return () => {
      window.removeEventListener("dragover", block)
      window.removeEventListener("drop", block)
    }
  }, [])

  const openMenu = useCallback<UIValue["openMenu"]>((e, items) => {
    const x = "clientX" in e ? e.clientX : e.x
    const y = "clientY" in e ? e.clientY : e.y
    setMenu({ x, y, items })
  }, [])

  const value = useMemo<UIValue>(
    () => ({
      toasts,
      toast,
      menu,
      openMenu,
      closeMenu: () => setMenu(null),
      paletteOpen,
      setPaletteOpen,
      newCall,
      openNewCall: (preset = {}) => setNewCall(preset),
      closeNewCall: () => setNewCall(null),
      newDoc,
      openNewDoc: (preset = {}) => setNewDoc(preset),
      closeNewDoc: () => setNewDoc(null),
      previewDocId,
      setPreviewDocId,
      confirmState,
      confirm,
    }),
    [toasts, toast, menu, openMenu, paletteOpen, newCall, newDoc, previewDocId, confirmState, confirm],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error("useUI hors UIProvider")
  return ctx
}
