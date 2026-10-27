import { AnimatePresence, motion, useAnimationControls } from "framer-motion"
import { ArrowRightIcon, CaretLeftIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useEffect, useRef, useState } from "react"
import { Avatar } from "../components/Controls"
import { TEAM, type TeamMemberId } from "../data/team"
import { useAuth } from "./AuthProvider"

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
export function LoginScreen() {
  const { signIn } = useAuth()
  const [selected, setSelected] = useState<TeamMemberId | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const shake = useAnimationControls()
  const root = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={root}
      className="login"
      onPointerMove={(e) => {
        const el = root.current
        if (!el) return
        el.style.setProperty("--mx", `${e.clientX}px`)
        el.style.setProperty("--my", `${e.clientY}px`)
      }}
    >
      <div className="login-dots" />
      <div className="login-dots login-dots-lit" />
      <div className="login-horizon" />

      <Clock />

      <div className="login-center">
        <motion.div
          className="login-logo"
          initial={{ opacity: 0, scale: 0.94, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="login-logo-tilt">
            <img src="/logo-mark.png" alt="OFM" draggable={false} />
          </div>
        </motion.div>
        <motion.div
          className="login-word"
          initial={{ opacity: 0, letterSpacing: "0.9em" }}
          animate={{ opacity: 1, letterSpacing: "0.62em" }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        >
          WORKSPACE
        </motion.div>

        <motion.div
          className="login-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
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
