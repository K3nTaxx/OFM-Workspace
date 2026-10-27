import { AnimatePresence, motion } from "framer-motion"
import { ArrowSquareOutIcon, CaretDownIcon, DownloadSimpleIcon, PlayCircleIcon, TrashIcon, XIcon } from "@phosphor-icons/react"
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { FileGlyph } from "../components/FileGlyph"
import { InlineText, Markdown } from "../components/Inputs"
import type { DocumentItem, TagColor } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { fileSize, fmt, youtubeEmbed } from "../lib/format"
import { useDocumentActions } from "../pages/Library"
import { useUI } from "../ui/UIProvider"
import { isTyping, useLayer } from "../ui/layers"

// Les lecteurs PDF (pdf.js) et Word (docx-preview) ne sont chargés qu'à la première ouverture d'un tel fichier.
const PdfViewer = lazy(() => import("../components/PdfViewer").then((m) => ({ default: m.PdfViewer })))
const DocxViewer = lazy(() => import("../components/DocxViewer").then((m) => ({ default: m.DocxViewer })))

const AUDIO = /\.(mp3|m4a|wav|ogg|aac|flac)$/i
const Loading = () => (
  <div className="empty">
    <div className="spinner" />
  </div>
)

/** Image : ajustée à la fenêtre, un clic pour la voir en taille réelle (et la faire défiler). */
function ImageView({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(false)
  return (
    <div className="quicklook-scroll" data-zoom={zoom} onClick={() => setZoom(!zoom)}>
      <img className="quicklook-img" src={url} alt={alt} draggable={false} />
    </div>
  )
}

/** Texte et Markdown : lus et affichés dans le thème du logiciel (accents corrects, texte sélectionnable). */
function TextView({ url, markdown }: { url: string; markdown: boolean }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch(url)
      .then((r) => r.text())
      .then((t) => alive && setText(t))
      .catch(() => alive && setText(""))
    return () => {
      alive = false
    }
  }, [url])
  if (text === null) return <Loading />
  return (
    <div className="quicklook-scroll">
      <div className="quicklook-text">{markdown ? <Markdown>{text}</Markdown> : <pre className="selectable">{text}</pre>}</div>
    </div>
  )
}

/** Carte centrée : liens, fichiers sans aperçu, audio. */
function Card({ doc, color, children }: { doc: DocumentItem; color?: TagColor; children: ReactNode }) {
  return (
    <div className="quicklook-card">
      <FileGlyph doc={doc} color={color} />
      {children}
    </div>
  )
}

/** Un menu ou une confirmation ouverts par-dessus l'aperçu gardent le clavier pour eux. */
const anyMenuOrDialog = () => !!document.querySelector(".menu, .alert")

/** Aperçu rapide d'un document, façon « Coup d'œil » de macOS. */
export function DocumentPreview() {
  const { previewDocId, setPreviewDocId, openMenu } = useUI()
  const { documents, categories, calls, store, refresh } = useWorkspace()
  const { download, remove, moveTo } = useDocumentActions()
  const navigate = useNavigate()
  const doc = documents.find((d) => d.id === previewDocId) ?? null
  // L'adresse est rattachée au document : en passant vite au suivant, on n'affiche jamais celle du précédent
  const [file, setFile] = useState<{ id: string; url: string | null } | null>(null)
  const current = file && file.id === doc?.id ? file : null
  const url = current?.url ?? null

  useEffect(() => {
    let alive = true
    let created: string | null = null
    if (doc) {
      store
        .getFileUrl(doc)
        .then((u) => {
          created = u
          if (alive) setFile({ id: doc.id, url: u })
          else if (u?.startsWith("blob:")) URL.revokeObjectURL(u)
        })
        .catch(() => alive && setFile({ id: doc.id, url: null }))
    }
    return () => {
      alive = false
      // Copies locales (mode démo) libérées en passant au document suivant
      if (created?.startsWith("blob:")) URL.revokeObjectURL(created)
    }
  }, [doc?.id, doc?.path, store])

  // Comme le Coup d'œil de macOS : ← → passent au document voisin de la même catégorie
  const siblings = doc ? documents.filter((d) => d.categoryId === doc.categoryId) : []
  const index = doc ? siblings.findIndex((d) => d.id === doc.id) : -1

  useLayer(!!doc, () => setPreviewDocId(null))

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      // Rien quand on écrit ou qu'un lecteur vidéo/audio a la main (← → y avancent de quelques secondes)
      if (e.defaultPrevented || isTyping(e.target) || anyMenuOrDialog()) return
      if (e.key === " ") {
        e.preventDefault()
        setPreviewDocId(null)
      }
      if (e.key === "ArrowRight" && index < siblings.length - 1) setPreviewDocId(siblings[index + 1].id)
      if (e.key === "ArrowLeft" && index > 0) setPreviewDocId(siblings[index - 1].id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [doc, setPreviewDocId, index, siblings])

  const close = () => setPreviewDocId(null)
  const cat = categories.find((c) => c.id === doc?.categoryId)
  const call = calls.find((c) => c.id === doc?.callId)

  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div
          className="sheet-backdrop"
          style={{ paddingTop: "4vh" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onPointerDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            className="quicklook"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="quicklook-head">
              <button type="button" className="btn btn--ghost btn--icon" onClick={close} aria-label="Fermer">
                <XIcon size={15} />
              </button>
              <InlineText
                className="quicklook-title"
                value={doc.title}
                onSave={async (title) => {
                  await store.updateDocument(doc.id, { title })
                  refresh()
                }}
              />
              <button
                type="button"
                className="prop-button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openMenu(
                    { x: r.left, y: r.bottom + 4 },
                    categories.map((c) => ({
                      label: c.name,
                      icon: <span className="dot" data-color={c.color} />,
                      checked: c.id === doc.categoryId,
                      onSelect: () => moveTo(doc, c),
                    })),
                  )
                }}
              >
                {cat ? (
                  <>
                    <span className="dot" data-color={cat.color} /> {cat.name}
                  </>
                ) : (
                  "Sans catégorie"
                )}
                <CaretDownIcon size={11} />
              </button>
              <span className="toolbar-spacer" />
              <button type="button" className="btn" onClick={() => download(doc)}>
                {doc.kind === "link" ? <ArrowSquareOutIcon size={15} /> : <DownloadSimpleIcon size={15} />}
                {doc.kind === "link" ? "Ouvrir" : "Télécharger"}
              </button>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => remove(doc)} aria-label="Supprimer">
                <TrashIcon size={15} />
              </button>
            </div>

            <div className="quicklook-body">
              {!current ? (
                <Loading />
              ) : !url ? (
                <Card doc={doc} color={cat?.color}>
                  <strong>Aperçu impossible</strong>
                  <span className="quicklook-card-meta">Le fichier n'a pas pu être chargé. Vérifie ta connexion.</span>
                </Card>
              ) : (
                <Viewer doc={doc} url={url} color={cat?.color} onOpen={() => download(doc)} />
              )}
            </div>

            <div className="quicklook-foot">
              <span className="tnum">{doc.kind === "link" ? "Lien" : doc.fileName ? `${doc.fileName} · ${fileSize(doc.size)}` : fileSize(doc.size)}</span>
              <span>·</span>
              <span>Ajouté le {fmt(doc.createdAt, "d MMMM yyyy")}</span>
              {doc.source && (
                <>
                  <span>·</span>
                  <span>Source : {doc.source}</span>
                </>
              )}
              {siblings.length > 1 && (
                <span className="quicklook-pos tnum" title="Flèches ← → pour passer d'un document à l'autre">
                  {index + 1} sur {siblings.length}
                </span>
              )}
              {call && (
                <button
                  type="button"
                  className="quicklook-call"
                  onClick={() => {
                    close()
                    navigate(`/appels/${call.id}`)
                  }}
                >
                  <PlayCircleIcon size={14} /> Appel #{call.number}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Le bon lecteur selon le type : PDF, Word, image, vidéo, YouTube, lien, texte, audio, ou fiche à télécharger. */
function Viewer({ doc, url, color, onOpen }: { doc: DocumentItem; url: string; color?: TagColor; onOpen: () => void }) {
  if (doc.kind === "pdf") {
    return (
      <Suspense fallback={<Loading />}>
        <PdfViewer url={url} />
      </Suspense>
    )
  }
  if (/\.docx$/i.test(doc.fileName ?? "")) {
    return (
      <Suspense fallback={<Loading />}>
        <DocxViewer url={url} />
      </Suspense>
    )
  }
  if (doc.kind === "image") return <ImageView url={url} alt={doc.title} />
  if (doc.kind === "video") return <video className="quicklook-media" src={url} controls />
  if (doc.kind === "text") return <TextView url={url} markdown={/\.md$/i.test(doc.fileName ?? "")} />
  if (doc.kind === "link") {
    const yt = youtubeEmbed(url)
    if (yt) {
      return <iframe className="quicklook-frame" src={yt} title={doc.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
    }
    return (
      <Card doc={doc} color={color}>
        <strong>{doc.title}</strong>
        <span className="quicklook-card-meta selectable">{url}</span>
        <button type="button" className="btn btn--primary" onClick={onOpen}>
          <ArrowSquareOutIcon size={15} /> Ouvrir le lien
        </button>
      </Card>
    )
  }
  if (AUDIO.test(doc.fileName ?? "")) {
    return (
      <Card doc={doc} color={color}>
        <strong>{doc.title}</strong>
        <audio src={url} controls />
      </Card>
    )
  }
  return (
    <Card doc={doc} color={color}>
      <strong>{doc.fileName ?? doc.title}</strong>
      <span className="quicklook-card-meta">Pas d'aperçu pour ce type de fichier · {fileSize(doc.size)}</span>
      <button type="button" className="btn btn--primary" onClick={onOpen}>
        <DownloadSimpleIcon size={15} /> Télécharger
      </button>
    </Card>
  )
}
