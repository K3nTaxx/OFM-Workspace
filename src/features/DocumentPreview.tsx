import { AnimatePresence, motion } from "framer-motion"
import { ArrowSquareOutIcon, CaretDownIcon, DownloadSimpleIcon, PlayCircleIcon, TrashIcon, XIcon } from "@phosphor-icons/react"
import { lazy, Suspense, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { InlineText } from "../components/Inputs"

// Le lecteur PDF (pdf.js) n'est chargé qu'à la première ouverture d'un PDF.
const PdfViewer = lazy(() => import("../components/PdfViewer").then((m) => ({ default: m.PdfViewer })))
import { useWorkspace } from "../data/workspace"
import { fileSize, fmt } from "../lib/format"
import { useDocumentActions } from "../pages/Library"
import { useUI } from "../ui/UIProvider"

/** Aperçu rapide d'un document, façon « Coup d'œil » de macOS. */
export function DocumentPreview() {
  const { previewDocId, setPreviewDocId, openMenu } = useUI()
  const { documents, categories, calls, store, refresh } = useWorkspace()
  const { download, remove, moveTo } = useDocumentActions()
  const navigate = useNavigate()
  const doc = documents.find((d) => d.id === previewDocId) ?? null
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setUrl(null)
    if (doc) store.getFileUrl(doc).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [doc?.id, doc?.path, store])

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewDocId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [doc, setPreviewDocId])

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
              {!url ? (
                <div className="empty">
                  <div className="spinner" />
                </div>
              ) : doc.kind === "pdf" ? (
                <Suspense
                  fallback={
                    <div className="empty">
                      <div className="spinner" />
                    </div>
                  }
                >
                  <PdfViewer url={url} />
                </Suspense>
              ) : doc.kind === "image" ? (
                <img className="quicklook-img" src={url} alt={doc.title} />
              ) : doc.kind === "video" ? (
                <video className="quicklook-img" src={url} controls />
              ) : doc.kind === "link" ? (
                <div className="empty">
                  <strong>{doc.title}</strong>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </div>
              ) : (
                <iframe className="quicklook-frame quicklook-frame--text" src={url} title={doc.title} />
              )}
            </div>

            <div className="quicklook-foot">
              <span className="tnum">{doc.kind === "link" ? "Lien" : fileSize(doc.size)}</span>
              <span>·</span>
              <span>Ajouté le {fmt(doc.createdAt, "d MMMM yyyy")}</span>
              {doc.source && (
                <>
                  <span>·</span>
                  <span>Source : {doc.source}</span>
                </>
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
