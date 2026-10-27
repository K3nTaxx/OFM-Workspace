import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { useEffect, useRef, useState } from "react"

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Lecteur PDF intégré (pages rendues en canvas) : même rendu dans tous les navigateurs, fond sombre.
 * Rapide sur téléphone : seules les pages proches de l'écran sont dessinées (et chargées), à 2× au plus.
 */
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
    setPages(0)
    // Ne télécharger que ce qui s'affiche (requêtes partielles) plutôt que tout le fichier avant la 1re page
    const task = getDocument({ url, disableAutoFetch: true, disableStream: true })
    let observer: IntersectionObserver | null = null

    ;(async () => {
      try {
        const doc: PDFDocumentProxy = await task.promise
        if (cancelled) return
        setPages(doc.numPages)
        const width = Math.min(container.clientWidth - (container.clientWidth < 600 ? 20 : 48), 860)
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const first = await doc.getPage(1)
        const base = first.getViewport({ scale: 1 })
        const scale = width / base.width

        // Une case par page, à la bonne taille tout de suite (le défilement ne saute pas quand elles se dessinent)
        const slots: HTMLCanvasElement[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const canvas = document.createElement("canvas")
          canvas.className = "pdf-page"
          canvas.dataset.page = String(n)
          canvas.style.width = `${width}px`
          canvas.style.height = `${base.height * scale}px`
          container.appendChild(canvas)
          slots.push(canvas)
        }

        const drawn = new Set<number>()
        const draw = async (n: number) => {
          if (drawn.has(n) || cancelled) return
          drawn.add(n)
          const page = n === 1 ? first : await doc.getPage(n)
          const viewport = page.getViewport({ scale: scale * ratio })
          const canvas = slots[n - 1]
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.height = `${viewport.height / ratio}px`
          await page.render({ canvas, viewport }).promise
        }

        await draw(1)
        observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) if (e.isIntersecting) draw(Number((e.target as HTMLElement).dataset.page))
          },
          { root: container.parentElement, rootMargin: "800px 0px" },
        )
        slots.slice(1).forEach((c) => observer!.observe(c))
      } catch {
        if (!cancelled) setError(true)
      }
    })()

    return () => {
      cancelled = true
      observer?.disconnect()
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
