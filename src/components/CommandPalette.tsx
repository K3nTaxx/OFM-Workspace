import { AnimatePresence, motion } from "framer-motion"
import {
  BooksIcon,
  CalendarBlankIcon,
  FilePdfIcon,
  HouseIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlayCircleIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "../data/workspace"
import { relativeDay } from "../lib/format"
import { useUI } from "../ui/UIProvider"
import { useLayer } from "../ui/layers"

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: ReactNode
  keywords: string
  run: () => void
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openNewCall, openNewDoc, setPreviewDocId } = useUI()
  const { calls, documents, categories, notes, store, refresh } = useWorkspace()
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen(!paletteOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [paletteOpen, setPaletteOpen])

  useLayer(paletteOpen, () => setPaletteOpen(false))

  useEffect(() => {
    if (paletteOpen) {
      setQ("")
      setActive(0)
    }
  }, [paletteOpen])

  const close = () => setPaletteOpen(false)

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => navigate(path)
    const base: Item[] = [
      { id: "new-call", group: "Actions", label: "Nouvel appel", hint: "N", icon: <PlusIcon size={16} />, keywords: "ajouter creer appel", run: () => openNewCall() },
      { id: "new-doc", group: "Actions", label: "Ajouter un document", hint: "D", icon: <UploadSimpleIcon size={16} />, keywords: "pdf image video lien fichier importer bibliotheque", run: () => openNewDoc() },
      { id: "go-home", group: "Aller à", label: "Accueil", icon: <HouseIcon size={16} />, keywords: "accueil home", run: go("/") },
      { id: "go-calls", group: "Aller à", label: "Appels", icon: <PlayCircleIcon size={16} />, keywords: "appels galerie", run: go("/appels") },
      { id: "go-cal", group: "Aller à", label: "Calendrier", icon: <CalendarBlankIcon size={16} />, keywords: "calendrier mois", run: go("/appels?vue=calendrier") },
      { id: "go-lib", group: "Aller à", label: "Bibliothèque", icon: <BooksIcon size={16} />, keywords: "bibliotheque pdf documents", run: go("/bibliotheque") },
      { id: "go-notes", group: "Aller à", label: "Notes", icon: <NotePencilIcon size={16} />, keywords: "notes bloc-notes", run: go("/notes") },
    ]
    base.splice(2, 0, {
      id: "new-note",
      group: "Actions",
      label: "Nouvelle note",
      icon: <NotePencilIcon size={16} />,
      keywords: "note ecrire bloc-notes liste",
      run: async () => {
        const n = await store.createNote({ title: "", blocks: [{ id: crypto.randomUUID(), type: "text", text: "" }] })
        await refresh()
        navigate(`/notes?note=${n.id}`)
      },
    })
    const noteItems: Item[] = notes.map((n) => ({
      id: `note-${n.id}`,
      group: "Notes",
      label: n.title.trim() || n.blocks.find((b) => b.text.trim())?.text.trim() || "Nouvelle note",
      hint: relativeDay(n.updatedAt.slice(0, 10)),
      icon: <NotePencilIcon size={16} />,
      keywords: n.blocks.map((b) => b.text).join(" "),
      run: go(`/notes?note=${n.id}`),
    }))
    const callItems: Item[] = calls.map((c) => ({
      id: `call-${c.id}`,
      group: "Appels",
      label: `Appel #${c.number} — ${c.title || "Sans titre"}`,
      hint: relativeDay(c.date),
      icon: <PlayCircleIcon size={16} />,
      keywords: `${c.title} ${c.themes.join(" ")} ${c.participants.join(" ")} ${c.summary?.markdown ?? ""}`,
      run: go(`/appels/${c.id}`),
    }))
    const docItems: Item[] = documents.map((d) => ({
      id: `doc-${d.id}`,
      group: "Documents",
      label: d.title,
      hint: categories.find((c) => c.id === d.categoryId)?.name,
      icon: d.kind === "link" ? <LinkSimpleIcon size={16} /> : <FilePdfIcon size={16} />,
      keywords: `${d.title} ${d.fileName ?? ""} ${d.source ?? ""}`,
      run: () => {
        navigate(d.categoryId ? `/bibliotheque?categorie=${d.categoryId}` : "/bibliotheque")
        setPreviewDocId(d.id)
      },
    }))
    return [...base, ...callItems, ...noteItems, ...docItems]
  }, [calls, documents, categories, notes, store, refresh, navigate, openNewCall, openNewDoc, setPreviewDocId])

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    if (!nq) return items.filter((i) => i.group !== "Documents").slice(0, 12)
    return items.filter((i) => norm(`${i.label} ${i.keywords}`).includes(nq)).slice(0, 30)
  }, [items, q])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const run = (i: Item | undefined) => {
    if (!i) return
    close()
    i.run()
  }

  let lastGroup = ""
  return createPortal(
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          className="sheet-backdrop"
          style={{ paddingTop: "14vh" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onPointerDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            className="palette"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 38 }}
          >
            <div className="palette-input">
              <MagnifyingGlassIcon size={18} />
              <input
                autoFocus
                value={q}
                placeholder="Rechercher un appel, un document, une action…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setActive((a) => Math.min(a + 1, filtered.length - 1))
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setActive((a) => Math.max(a - 1, 0))
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    run(filtered[active])
                  } else if (e.key === "Escape") close()
                }}
              />
              <button type="button" className="palette-cancel mobile-only" onClick={close}>
                Annuler
              </button>
            </div>
            <div className="palette-list" ref={listRef}>
              {filtered.length === 0 && <div className="empty">Aucun résultat pour « {q} »</div>}
              {filtered.map((item, index) => {
                const header = item.group !== lastGroup ? item.group : null
                lastGroup = item.group
                return (
                  <div key={item.id}>
                    {header && <div className="palette-group">{header}</div>}
                    <button
                      type="button"
                      className="palette-item"
                      data-index={index}
                      data-active={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(item)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.hint && <span className="palette-hint">{item.hint}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="palette-foot">
              <span>
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> naviguer
              </span>
              <span>
                <span className="kbd">Entrée</span> ouvrir
              </span>
              <span>
                <span className="kbd">Échap</span> fermer
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
