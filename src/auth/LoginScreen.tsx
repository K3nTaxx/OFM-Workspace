import { AnimatePresence, motion, useAnimationControls } from "framer-motion"
import { ArrowRightIcon, CaretLeftIcon, LockSimpleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { AppIcon } from "../components/Chrome"
import { Avatar } from "../components/Controls"
import { TEAM, type TeamMemberId } from "../data/team"
import { DEMO_MODE, useAuth } from "./AuthProvider"

/** Écran de connexion façon écran de verrouillage macOS : on choisit son profil, puis on tape son mot de passe. */
export function LoginScreen() {
  const { signIn } = useAuth()
  const [selected, setSelected] = useState<TeamMemberId | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const shake = useAnimationControls()

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

  const member = TEAM.find((m) => m.id === selected)

  return (
    <div className="login">
      <div className="login-grid" />
      <motion.div className="login-brand" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <AppIcon size={76} />
        <h1>Workspace OFM</h1>
        <p>{selected ? " " : "Qui se connecte ?"}</p>
      </motion.div>

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
                  <div className="login-user" style={{ paddingBottom: 0 }}>
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

      <div className="login-foot">
        <LockSimpleIcon size={12} />
        {DEMO_MODE ? "Mode démo — les données restent dans ce navigateur" : `Connexion sécurisée${member ? ` · ${member.email}` : ""}`}
      </div>
    </div>
  )
}
