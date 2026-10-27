import { motion } from "framer-motion"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Call } from "../data/types"

type ThumbCall = Pick<Call, "id" | "number" | "title" | "hue" | "status">

/** Où se trouve la miniature : la grande image de la fiche d'appel, ou un point de départ (carte, accueil, barre latérale). */
type Slot = "hero" | "card" | "feature" | "recent"

interface Props {
  call: ThumbCall
  /** Active la transition vers la fiche d'appel (et le retour) ; `true` = carte d'appel. */
  shared?: boolean | Slot
  className?: string
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

// Vol des miniatures entre deux vues :
// - la miniature sur laquelle on clique note sa position ; la grande image de la fiche s'envole depuis là ;
// - en quittant la fiche, la grande image note la sienne ; on revient se poser là d'où l'on était parti.
// « owner » évite qu'une miniature reparte de sa propre position (double montage du mode strict de React).
interface Departure {
  box: Box
  owner: object
  slot: Slot
  at: number
}
const departures = new Map<string, Departure[]>()
const origins = new Map<string, Slot>()
const claims = new Map<string, { owner: object; at: number }>()
const FLIGHT_WINDOW = 1200

function depart(id: string, owner: object, slot: Slot, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  if (!r.width) return
  const now = performance.now()
  const list = (departures.get(id) ?? []).filter((d) => now - d.at < FLIGHT_WINDOW)
  list.push({ box: { left: r.left, top: r.top, width: r.width, height: r.height }, owner, slot, at: now })
  departures.set(id, list)
}

/** Position de départ du vol vers cette miniature, ou null si elle doit simplement apparaître. */
function takeOff(id: string, owner: object, slot: Slot): Box | null {
  const now = performance.now()
  const recent = (departures.get(id) ?? []).filter((d) => now - d.at < FLIGHT_WINDOW && d.owner !== owner)
  if (slot === "hero") {
    const from = recent.filter((d) => d.slot !== "hero").at(-1)
    if (from) origins.set(id, from.slot)
    return from?.box ?? null
  }
  // Retour : une seule miniature se pose, celle d'où l'on était parti
  const from = recent.filter((d) => d.slot === "hero").at(-1)
  if (!from || (origins.get(id) ?? slot) !== slot) return null
  const claim = claims.get(id)
  if (claim && claim.owner !== owner && now - claim.at < FLIGHT_WINDOW) return null
  claims.set(id, { owner, at: now })
  return from.box
}

function ThumbContent({ call }: { call: ThumbCall }) {
  const planned = call.status === "planned"
  return (
    <>
      <div className="thumb-bg" />
      <div className="thumb-glow" />
      <div className="thumb-grid" />
      <span className="thumb-badge">{planned ? "À VENIR" : "OFM WORKSPACE"}</span>
      <div className="thumb-play" data-planned={planned}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 4.5v15l12.5-7.5z" />
        </svg>
      </div>
      <div className="thumb-caption">
        <b>APPEL #{call.number}</b>
        <span>{call.title || "Sans titre"}</span>
      </div>
    </>
  )
}

/** Miniature « lecteur vidéo » générée en CSS : aucune image à créer, toujours à la bonne taille. */
export function CallThumbnail({ call, shared = false, className = "" }: Props) {
  const slot: Slot | null = shared === true ? "card" : shared || null
  const ref = useRef<HTMLDivElement>(null)
  const owner = useRef({}).current
  const [flight, setFlight] = useState<{ from: Box; to: Box; radius: string } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!slot || !el) return
    const from = takeOff(call.id, owner, slot)
    let frame = 0
    if (from) {
      // Cachée avant le premier affichage ; mesurée à l'image suivante (la page a retrouvé son défilement)
      el.style.visibility = "hidden"
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const onScreen = r.bottom > 0 && r.top < window.innerHeight && r.width > 0
        const moved = Math.abs(r.left - from.left) + Math.abs(r.top - from.top) + Math.abs(r.width - from.width) > 2
        if (onScreen && moved) {
          setFlight({ from, to: { left: r.left, top: r.top, width: r.width, height: r.height }, radius: getComputedStyle(el).borderRadius })
        } else el.style.visibility = ""
      })
    }
    // Point de départ : un clic n'importe où sur la carte (ou la ligne) qui contient la miniature
    const host = slot === "hero" ? null : (el.closest<HTMLElement>(`button, a, [role="link"]`) ?? el)
    const press = () => depart(call.id, owner, slot, el)
    host?.addEventListener("pointerdown", press)
    return () => {
      cancelAnimationFrame(frame)
      host?.removeEventListener("pointerdown", press)
      el.style.visibility = ""
      if (slot === "hero") depart(call.id, owner, slot, el)
    }
  }, [slot, call.id, owner])

  return (
    <>
      <div ref={ref} className={`thumb ${className}`} style={{ ["--h" as string]: call.hue }}>
        <ThumbContent call={call} />
      </div>
      {flight &&
        createPortal(
          // Copie de la miniature, au-dessus de tout et toujours opaque, qui vole de l'ancienne place à la nouvelle
          <motion.div
            className="thumb thumb-flight"
            style={{
              ["--h" as string]: call.hue,
              left: flight.to.left,
              top: flight.to.top,
              width: flight.to.width,
              height: flight.to.height,
              borderRadius: flight.radius,
              transformOrigin: "0 0",
            }}
            initial={{
              x: flight.from.left - flight.to.left,
              y: flight.from.top - flight.to.top,
              scaleX: flight.from.width / flight.to.width,
              scaleY: flight.from.height / flight.to.height,
            }}
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1 }}
            transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              if (ref.current) ref.current.style.visibility = ""
              setFlight(null)
            }}
          >
            <ThumbContent call={call} />
          </motion.div>,
          document.body,
        )}
    </>
  )
}
