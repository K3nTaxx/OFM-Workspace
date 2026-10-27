import { motion } from "framer-motion"
import type { Call } from "../data/types"

interface Props {
  call: Pick<Call, "id" | "number" | "title" | "hue" | "status">
  /** Active la transition partagée vers la fiche d'appel. */
  shared?: boolean
  className?: string
}

/** Miniature « lecteur vidéo » générée en CSS : aucune image à créer, toujours à la bonne taille. */
export function CallThumbnail({ call, shared = false, className = "" }: Props) {
  const planned = call.status === "planned"
  return (
    <motion.div
      layoutId={shared ? `thumb-${call.id}` : undefined}
      className={`thumb ${className}`}
      style={{ ["--h" as string]: call.hue }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
    >
      <div className="thumb-bg" />
      <div className="thumb-glow" />
      <div className="thumb-grid" />
      <span className="thumb-badge">{planned ? "À VENIR" : "WORKSPACE OFM"}</span>
      <div className="thumb-play" data-planned={planned}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 4.5v15l12.5-7.5z" />
        </svg>
      </div>
      <div className="thumb-caption">
        <b>APPEL #{call.number}</b>
        <span>{call.title || "Sans titre"}</span>
      </div>
      {call.status === "analyzing" && (
        <div className="thumb-veil">
          <div className="spinner" />
          <span>Analyse en cours…</span>
        </div>
      )}
    </motion.div>
  )
}
