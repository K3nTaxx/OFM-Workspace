import { animate, AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion"
import { ArrowRightIcon, CaretLeftIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Avatar } from "../components/Controls"
import { TEAM, type TeamMemberId } from "../data/team"
import { useAuth } from "./AuthProvider"

/**
 * idle : écran de connexion normal · leaving : connexion réussie, le logo s'envole vers la barre latérale et l'écran
 * s'efface sur le logiciel · entering : déconnexion, le logo repart de la barre latérale vers le centre.
 */
export type LoginPhase = "idle" | "entering" | "leaving"

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const
const EASE_FLY = [0.6, 0, 0.12, 1] as const

/** Horloge discrète en haut de l'écran, comme un écran de verrouillage. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="login-clock tnum">
      <span>{format(now, "EEEE d MMMM", { locale: fr })}</span>
      <strong>{format(now, "HH:mm")}</strong>
    </div>
  )
}

/** Écran de connexion : grand logo OFM, grille de points éclairée par la souris, puis choix du profil et mot de passe. */
export function LoginScreen({ phase = "idle", onDone }: { phase?: LoginPhase; onDone?: () => void }) {
  const { signIn } = useAuth()
  const [selected, setSelected] = useState<TeamMemberId | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const shake = useAnimationControls()
  const lit = useRef<HTMLDivElement>(null)
  const fly = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const done = useRef(onDone)
  done.current = onDone
  const [intro] = useState(phase)

  const submit = async () => {
    if (!selected || !password || busy) return
    setBusy(true)
    const ok = await signIn(selected, password)
    setBusy(false)
    if (!ok) {
      setError("Mot de passe incorrect")
      setPassword("")
      shake.start({ x: [0, -10, 9, -7, 5, -2, 0], transition: { duration: 0.42 } })
    }
  }

  // Le logo vole entre le centre de l'écran et le « OFM » de la barre latérale (connexion et déconnexion)
  useLayoutEffect(() => {
    if (phase === "idle") return
    const el = fly.current
    // Le logo visible : barre latérale sur PC, en-tête de l'accueil sur téléphone
    const brand = [...document.querySelectorAll<HTMLElement>(".brand-logo")].find((b) => b.getBoundingClientRect().height > 0)
    if (!el || reduced) {
      const t = setTimeout(() => done.current?.(), 350)
      return () => clearTimeout(t)
    }
    if (!brand) {
      // Pas de logo à l'écran (autre page sur téléphone) : le grand logo s'efface ou apparaît sur place
      const anim = phase === "leaving"
        ? animate(el, { opacity: [1, 0], scale: [1, 0.92] }, { duration: 0.4, ease: EASE_OUT })
        : animate(el, { opacity: [0, 1], scale: [0.92, 1] }, { duration: 0.5, ease: EASE_OUT })
      const t = setTimeout(() => done.current?.(), phase === "leaving" ? 700 : 600)
      return () => {
        anim.stop()
        clearTimeout(t)
        el.style.transform = ""
        el.style.opacity = ""
      }
    }
    el.style.transform = ""
    el.style.opacity = ""
    const from = el.getBoundingClientRect()
    const b = brand.getBoundingClientRect()
    const scale = b.height / from.height
    // Le « OFM » occupe le début du logo de la barre latérale, sur toute sa hauteur : même ratio que le grand logo
    const away = { x: b.left - from.left, y: b.top - from.top }
    el.style.transformOrigin = "0 0"
    brand.style.visibility = "hidden"

    let cancelled = false
    let current: { stop: () => void } | null = null
    const run = async () => {
      if (phase === "leaving") {
        current = animate(el, { x: [0, away.x], y: [0, away.y], scale: [1, scale] }, { duration: 0.78, delay: 0.08, ease: EASE_FLY })
        await current
        if (cancelled) return
        // Posé : le vrai logo (avec « WORKSPACE ») apparaît pendant que la copie volante s'efface
        brand.style.visibility = ""
        brand.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" })
        current = animate(el, { opacity: 0 }, { duration: 0.26 })
        await current
      } else {
        el.style.transform = `translateX(${away.x}px) translateY(${away.y}px) scale(${scale})`
        current = animate(el, { x: [away.x, 0], y: [away.y, 0], scale: [scale, 1] }, { duration: 0.74, ease: EASE_FLY })
        await current
      }
      if (!cancelled) done.current?.()
    }
    run()
    return () => {
      cancelled = true
      current?.stop()
      el.style.transform = ""
      el.style.opacity = ""
      brand.style.visibility = ""
    }
  }, [phase, reduced])

  const leaving = phase === "leaving"

  return (
    <div
      className="login"
      data-phase={phase}
      onPointerMove={(e) => {
        // Le halo bleu suit la souris : seul un petit carré bouge (pas de repeinture de tout l'écran)
        const el = lit.current
        if (!el) return
        const x = e.clientX - 260
        const y = e.clientY - 260
        el.style.transform = `translate(${x}px, ${y}px)`
        el.style.backgroundPosition = `${(window.innerWidth - 22) / 2 - x}px ${(window.innerHeight - 22) / 2 - y}px`
        el.style.opacity = "1"
      }}
    >
      <motion.div
        className="login-bg"
        initial={{ opacity: intro === "entering" ? 0 : 1 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={leaving ? { duration: 0.6, delay: 0.14, ease: [0.4, 0, 0.2, 1] } : { duration: 0.42, ease: EASE_OUT }}
      >
        <div className="login-dots" />
        <div ref={lit} className="login-lit" />
        <div className="login-horizon" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? 0.16 : 0.6, delay: intro === "entering" && !leaving ? 0.35 : 0.1 }}
      >
        <Clock />
      </motion.div>

      <div className="login-center">
        <motion.div
          className="login-logo"
          initial={intro === "idle" ? { opacity: 0, scale: 0.94 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <div ref={fly} className="login-logo-fly">
            <img src="/logo-mark.png" alt="OFM" draggable={false} />
          </div>
        </motion.div>
        <motion.div
          className="login-word"
          initial={{ opacity: 0, letterSpacing: "0.9em" }}
          animate={leaving ? { opacity: 0 } : { opacity: 1, letterSpacing: "0.62em" }}
          transition={leaving ? { duration: 0.16 } : { duration: 0.8, delay: intro === "entering" ? 0.5 : 0.1, ease: EASE_OUT }}
        >
          WORKSPACE
        </motion.div>

        <motion.div
          className="login-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={leaving ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
          transition={leaving ? { duration: 0.18 } : { duration: 0.6, delay: intro === "entering" ? 0.55 : 0.16, ease: EASE_OUT }}
        >
          <p className="login-ask">{selected ? " " : "Qui se connecte ?"}</p>
          <div className="login-users">
            <AnimatePresence mode="popLayout" initial={false}>
              {TEAM.filter((m) => !selected || m.id === selected).map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                >
                  {selected ? (
                    <motion.div className="login-form" animate={shake}>
                      <div className="login-user" data-static>
                        <Avatar name={m.name} />
                        <span className="login-user-name">{m.name}</span>
                      </div>
                      <form
                        className="login-pass"
                        onSubmit={(e) => {
                          e.preventDefault()
                          submit()
                        }}
                      >
                        <input
                          autoFocus
                          type="password"
                          className="input"
                          placeholder="Mot de passe"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            setError("")
                          }}
                          autoComplete="current-password"
                        />
                        <button type="submit" className="go" disabled={!password || busy} aria-label="Se connecter">
                          {busy ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <ArrowRightIcon size={13} weight="bold" />}
                        </button>
                      </form>
                      <span className="login-error">{error}</span>
                      <button
                        type="button"
                        className="login-back"
                        onClick={() => {
                          setSelected(null)
                          setPassword("")
                          setError("")
                        }}
                      >
                        <CaretLeftIcon size={11} style={{ display: "inline", verticalAlign: -1 }} /> Changer de profil
                      </button>
                    </motion.div>
                  ) : (
                    <button type="button" className="login-user" onClick={() => setSelected(m.id)}>
                      <Avatar name={m.name} />
                      <span className="login-user-name">{m.name}</span>
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
