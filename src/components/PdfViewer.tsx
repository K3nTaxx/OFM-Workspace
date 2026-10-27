import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { useEffect, useRef, useState } from "react"

GlobalWorkerOptions.workerSrc = workerUrl

/** Lecteur PDF intégré (pages rendues en canvas) : même rendu dans tous les navigateurs, fond sombre. */
export function PdfViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const container = host.current
    if (!container) return
    container.innerHTML = ""
    setError(false)
    const task = getDocument({ url })

    ;(async () => {
      try {
        const doc: PDFDocumentProxy = await task.promise
        if (cancelled) return
        setPages(doc.numPages)
        const width = Math.min(container.clientWidth - 48, 860)
        const ratio = window.devicePixelRatio || 1
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (width / base.width) * ratio })
          const canvas = document.createElement("canvas")
          canvas.className = "pdf-page"
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / ratio}px`
          canvas.style.height = `${viewport.height / ratio}px`
          container.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()

    return () => {
      cancelled = true
      task.destroy()
    }
  }, [url])

  return (
    <div className="pdf-viewer">
      {error && (
        <div className="empty">
          <strong>Aperçu impossible</strong>
          Télécharge le fichier pour l'ouvrir.
        </div>
      )}
      <div ref={host} className="pdf-pages" />
      {pages > 0 && <span className="pdf-count tnum">{pages} page{pages > 1 ? "s" : ""}</span>}
    </div>
  )
}
