import { renderAsync } from "docx-preview"
import { useEffect, useRef, useState } from "react"

/** Lecteur Word (.docx) intégré : vraies pages (mise en page, images, tableaux) sur fond sombre, comme le lecteur PDF. */
export function DocxViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(0)
  const [state, setState] = useState<"loading" | "ok" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    const container = host.current
    if (!container) return
    container.innerHTML = ""
    setState("loading")
    setPages(0)

    ;(async () => {
      try {
        const blob = await (await fetch(url)).blob()
        if (cancelled) return
        await renderAsync(blob, container, container, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          useBase64URL: true,
          renderComments: false,
          renderChanges: false,
        })
        if (cancelled) return
        // Les pages gardent leur format (A4…) ; si la fenêtre est plus étroite, tout est réduit pour tenir en largeur
        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper")
        const page = container.querySelector<HTMLElement>("section.docx")
        if (wrapper && page) {
          const scale = Math.min(1, (container.clientWidth - 48) / page.offsetWidth)
          if (scale < 1) wrapper.style.zoom = String(scale)
        }
        setPages(container.querySelectorAll("section.docx").length)
        setState("ok")
      } catch {
        if (!cancelled) setState("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="pdf-viewer docx-viewer">
      {state === "loading" && (
        <div className="empty">
          <div className="spinner" />
        </div>
      )}
      {state === "error" && (
        <div className="empty">
          <strong>Aperçu impossible</strong>
          Télécharge le fichier pour l'ouvrir.
        </div>
      )}
      <div ref={host} className="docx-host selectable" />
      {pages > 0 && <span className="pdf-count tnum">{pages} page{pages > 1 ? "s" : ""}</span>}
    </div>
  )
}
