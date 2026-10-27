import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowSquareOutIcon,
  BooksIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FolderSimpleIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  SquaresFourIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Toolbar } from "../components/Chrome"
import { Segmented } from "../components/Controls"
import { FileGlyph, kindFromFile } from "../components/FileGlyph"
import { CATEGORY_COLORS } from "../data/catalog"
import type { Category, DocumentItem } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { fileSize, fmt } from "../lib/format"
import { useUI, type MenuEntry } from "../ui/UIProvider"
import { anyLayerOpen } from "../ui/layers"
import { useRemembered } from "../ui/remember"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

const COLOR_NAMES: Record<string, string> = {
  blue: "Bleu",
  green: "Vert",
  pink: "Rose",
  purple: "Violet",
  red: "Rouge",
  orange: "Orange",
  yellow: "Jaune",
  brown: "Marron",
  gray: "Gris",
}

export function useDocumentActions() {
  const { store, refresh, categories } = useWorkspace()
  const { toast, confirm, setPreviewDocId } = useUI()

  const download = async (doc: DocumentItem) => {
    const url = await store.getFileUrl(doc)
    if (!url) return toast("Fichier introuvable", "error")
    if (doc.kind === "link") return window.open(url, "_blank", "noopener")
    // Une adresse d'un autre site (stockage Supabase) ouvrirait le fichier à la place du logiciel : on passe par une copie locale
    const blob = await (await fetch(url)).blob()
    if (url.startsWith("blob:")) URL.revokeObjectURL(url)
    const local = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = local
    a.download = doc.fileName ?? doc.title
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(local), 10_000)
  }

  const remove = async (doc: DocumentItem) => {
    const ok = await confirm({
      title: `Supprimer « ${doc.title} » ?`,
      message: "Le fichier sera retiré de la bibliothèque pour vous deux.",
      confirmLabel: "Supprimer",
      danger: true,
    })
    if (!ok) return
    await store.deleteDocument(doc)
    setPreviewDocId(null)
    await refresh()
    toast("Document supprimé")
  }

  const moveTo = async (doc: DocumentItem, cat: Category | null) => {
    await store.updateDocument(doc.id, { categoryId: cat?.id ?? null })
    await refresh()
    toast(`Déplacé dans « ${cat?.name ?? "Sans catégorie"} »`)
  }

  const menuFor = (doc: DocumentItem): MenuEntry[] => [
    { label: "Aperçu", icon: <EyeIcon size={15} />, shortcut: "Espace", onSelect: () => setPreviewDocId(doc.id) },
    {
      label: doc.kind === "link" ? "Ouvrir le lien" : "Télécharger",
      icon: doc.kind === "link" ? <ArrowSquareOutIcon size={15} /> : <DownloadSimpleIcon size={15} />,
      onSelect: () => download(doc),
    },
    { separator: true },
    { heading: "Déplacer vers" },
    ...categories.map((c) => ({
      label: c.name,
      icon: <span className="dot" data-color={c.color} />,
      checked: c.id === doc.categoryId,
      onSelect: () => moveTo(doc, c),
    })),
    { separator: true },
    { label: "Supprimer…", icon: <TrashIcon size={15} />, danger: true, onSelect: () => remove(doc) },
  ]

  return { download, remove, moveTo, menuFor }
}

export function Library() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { categories, documents, store, refresh } = useWorkspace()
  const { openNewDoc, openMenu, setPreviewDocId, toast, confirm } = useUI()
  const { menuFor } = useDocumentActions()
  const [layout, setLayout] = useRemembered<"grille" | "liste">("bibliotheque.affichage", "grille")
  const [q, setQ] = useRemembered("bibliotheque.recherche", "")
  const [dragOver, setDragOver] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const catId = params.get("categorie")
  const current = categories.find((c) => c.id === catId) ?? null
  const mainRef = useRef<HTMLDivElement>(null)

  // Nouvelle catégorie : on repart en haut, sans animation (la vue change simplement)
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
    setSelected(null)
  }, [catId])

  const visible = useMemo(() => {
    const nq = norm(q.trim())
    return documents.filter(
      (d) => (!current || d.categoryId === current.id) && (!nq || norm(`${d.title} ${d.fileName ?? ""} ${d.source ?? ""}`).includes(nq)),
    )
  }, [documents, current, q])

  const upload = async (files: File[], categoryId = current?.id ?? null) => {
    try {
      for (const f of files) {
        await store.createDocument(
          { title: f.name.replace(/\.[^.]+$/, ""), fileName: f.name, kind: kindFromFile(f), categoryId, source: "Nous" },
          f,
        )
      }
      toast(files.length > 1 ? `${files.length} documents ajoutés` : "Document ajouté")
    } catch (e) {
      console.error(e)
      toast("Un fichier n'a pas pu être envoyé. Vérifie ta connexion.", "error")
    } finally {
      await refresh()
    }
  }

  const addLink = async (url: string) => {
    await store.createDocument({
      title: url.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0],
      kind: "link",
      url,
      categoryId: current?.id ?? null,
      source: "Nous",
    })
    await refresh()
    toast("Lien ajouté")
  }

  // Ctrl+V dans la bibliothèque : une image copiée, des fichiers ou une adresse web sont ajoutés au dossier ouvert
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]")) || !e.clipboardData) return
      const files = [...e.clipboardData.files]
      const text = e.clipboardData.getData("text/plain").trim()
      if (files.length) upload(files.map((f, i) => (f.name === "image.png" ? new File([f], `Image collée ${i + 1}.png`, { type: f.type }) : f)))
      else if (/^https?:\/\/\S+$/.test(text)) addLink(text)
      else return
      e.preventDefault()
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  const categoryMenu = (cat: Category): MenuEntry[] => [
    { label: "Renommer", icon: <PencilSimpleIcon size={15} />, onSelect: () => setRenaming(cat.id) },
    { heading: "Couleur" },
    ...CATEGORY_COLORS.map((color) => ({
      label: COLOR_NAMES[color],
      icon: <span className="dot" data-color={color} />,
      checked: cat.color === color,
      onSelect: async () => {
        await store.updateCategory(cat.id, { color })
        refresh()
      },
    })),
    { separator: true },
    {
      label: "Supprimer la catégorie…",
      icon: <TrashIcon size={15} />,
      danger: true,
      onSelect: async () => {
        const ok = await confirm({
          title: `Supprimer « ${cat.name} » ?`,
          message: "Les documents ne sont pas supprimés : ils passent dans « Sans catégorie ».",
          confirmLabel: "Supprimer",
          danger: true,
        })
        if (!ok) return
        await store.deleteCategory(cat.id)
        await refresh()
        if (catId === cat.id) navigate("/bibliotheque")
      },
    },
  ]

  const commitCategory = async (cat: Category | null, name: string) => {
    const n = name.trim()
    if (cat && n && n !== cat.name) await store.updateCategory(cat.id, { name: n })
    if (!cat && n) {
      const created = await store.createCategory({
        name: n,
        color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        position: categories.length,
      })
      navigate(`/bibliotheque?categorie=${created.id}`)
    }
    setRenaming(null)
    setCreating(false)
    refresh()
  }

  return (
    <>
      <Toolbar>
        <div className="toolbar-title">
          {current ? (
            <>
              <span className="dot" data-color={current.color} style={{ alignSelf: "center" }} />
              {current.name}
            </>
          ) : (
            "Bibliothèque"
          )}
          <small className="tnum">{visible.length}</small>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group">
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              { value: "grille", label: "Grille", icon: <SquaresFourIcon size={14} /> },
              { value: "liste", label: "Liste", icon: <ListIcon size={14} /> },
            ]}
          />
          <label className="search">
            <MagnifyingGlassIcon size={14} />
            <input className="input" placeholder="Rechercher un document" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button type="button" className="btn btn--primary" onClick={() => openNewDoc({ categoryId: current?.id ?? null })}>
            <UploadSimpleIcon size={15} />
            Ajouter
          </button>
        </div>
      </Toolbar>

      <div className="library">
        <nav className="library-cats">
          <button type="button" className="nav-item" data-active={!current} onClick={() => navigate("/bibliotheque")}>
            <BooksIcon size={16} />
            <span className="nav-item-label">Tous les documents</span>
            <span className="nav-item-count">{documents.length}</span>
          </button>
          <div className="library-cats-title section-title">Catégories</div>
          {categories.map((cat) =>
            renaming === cat.id ? (
              <CategoryInput key={cat.id} initial={cat.name} onDone={(n) => commitCategory(cat, n)} />
            ) : (
              <button
                key={cat.id}
                type="button"
                className="nav-item"
                data-active={current?.id === cat.id}
                onClick={() => navigate(`/bibliotheque?categorie=${cat.id}`)}
                onDoubleClick={() => setRenaming(cat.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openMenu(e, categoryMenu(cat))
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault()
                  const docId = e.dataTransfer.getData("text/ofm-doc")
                  if (docId) {
                    await store.updateDocument(docId, { categoryId: cat.id })
                    await refresh()
                    toast(`Déplacé dans « ${cat.name} »`)
                  } else if (e.dataTransfer.files.length) {
                    // Fichiers lâchés depuis l'ordinateur directement sur une catégorie : rangés dedans
                    upload([...e.dataTransfer.files], cat.id)
                  }
                }}
              >
                <span className="dot" data-color={cat.color} />
                <span className="nav-item-label">{cat.name}</span>
                <span className="nav-item-count">{documents.filter((d) => d.categoryId === cat.id).length}</span>
              </button>
            ),
          )}
          {creating ? (
            <CategoryInput initial="" onDone={(n) => commitCategory(null, n)} />
          ) : (
            <button type="button" className="nav-item library-new-cat" onClick={() => setCreating(true)}>
              <PlusIcon size={14} />
              <span className="nav-item-label">Nouvelle catégorie</span>
            </button>
          )}
        </nav>

        <div
          ref={mainRef}
          className="library-main page-scroll"
          onClick={() => setSelected(null)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list")) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const files = [...e.dataTransfer.files]
            const url = e.dataTransfer.getData("text/uri-list").split("\n")[0]?.trim()
            if (files.length) upload(files)
            else if (url && /^https?:\/\//.test(url)) addLink(url)
          }}
          onKeyDown={(e) => {
            if (e.key === " " && selected && !anyLayerOpen()) {
              e.preventDefault()
              setPreviewDocId(selected)
            }
          }}
          tabIndex={-1}
        >
          {visible.length === 0 ? (
            <div className="empty" style={{ paddingTop: 110 }}>
              <FolderSimpleIcon className="empty-icon" size={46} weight="thin" />
              <strong>{q ? "Aucun document trouvé" : "Ce dossier est vide"}</strong>
              {q ? "Essaie un autre mot." : "Glisse tes fichiers ici (PDF, images, vidéos, liens…) ou colle-les avec Ctrl+V : ils seront rangés dans ce dossier."}
              {!q && (
                <button type="button" className="btn" onClick={() => openNewDoc({ categoryId: current?.id ?? null })}>
                  <UploadSimpleIcon size={15} /> Choisir des fichiers
                </button>
              )}
            </div>
          ) : layout === "grille" ? (
            <div className="doc-grid">
              {visible.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="doc-tile"
                  data-selected={selected === d.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/ofm-doc", d.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(d.id)
                  }}
                  onDoubleClick={() => setPreviewDocId(d.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setSelected(d.id)
                    openMenu(e, menuFor(d))
                  }}
                >
                  <FileGlyph doc={d} color={categories.find((c) => c.id === d.categoryId)?.color} />
                  <span className="doc-tile-name">{d.title}</span>
                  <span className="doc-tile-meta tnum">{d.kind === "link" ? "Lien" : fileSize(d.size)}</span>
                </button>
              ))}
            </div>
          ) : (
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Source</th>
                  <th className="num">Taille</th>
                  <th className="num">Ajouté le</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const cat = categories.find((c) => c.id === d.categoryId)
                  return (
                    <tr
                      key={d.id}
                      data-selected={selected === d.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/ofm-doc", d.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(d.id)
                      }}
                      onDoubleClick={() => setPreviewDocId(d.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setSelected(d.id)
                        openMenu(e, menuFor(d))
                      }}
                    >
                      <td>
                        <span className="doc-row-name">
                          <FileGlyph doc={d} color={cat?.color} small />
                          {d.title}
                        </span>
                      </td>
                      <td>{cat ? <span className="doc-row-cat"><span className="dot" data-color={cat.color} />{cat.name}</span> : <span className="muted">—</span>}</td>
                      <td className="muted">{d.source ?? "—"}</td>
                      <td className="num muted tnum">{d.kind === "link" ? "—" : fileSize(d.size)}</td>
                      <td className="num muted tnum">{fmt(d.createdAt, "d MMM yyyy")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <AnimatePresence>
            {dragOver && (
              <motion.div className="drop-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <div className="drop-overlay-card">
                  <UploadSimpleIcon size={22} />
                  Déposer dans « {current?.name ?? "Bibliothèque"} »
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

function CategoryInput({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [v, setV] = useState(initial)
  const done = useRef(false)
  const finish = (name: string) => {
    if (done.current) return
    done.current = true
    onDone(name)
  }
  return (
    <div className="nav-item nav-item--editing">
      <span className="dot" />
      <input
        autoFocus
        className="inline-text"
        value={v}
        placeholder="Nom de la catégorie"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => finish(v)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(v)
          if (e.key === "Escape") {
            e.preventDefault()
            finish(initial)
          }
        }}
      />
    </div>
  )
}
