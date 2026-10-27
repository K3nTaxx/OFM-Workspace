import { Component, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./auth/AuthProvider"
import { LoginScreen, type LoginPhase } from "./auth/LoginScreen"
import { Sidebar, StatusBar, TabBar } from "./components/Chrome"
import { CommandPalette } from "./components/CommandPalette"
import { ConfirmDialog, ContextMenu, Toasts } from "./components/Overlays"
import { useWorkspace, WorkspaceProvider } from "./data/workspace"
import { DocumentPreview } from "./features/DocumentPreview"
import { NewCallSheet } from "./features/NewCallSheet"
import { NewDocumentSheet } from "./features/NewDocumentSheet"
import { CallDetail } from "./pages/CallDetail"
import { Calls } from "./pages/Calls"
import { Home } from "./pages/Home"
import { Library } from "./pages/Library"
import { playEntrance } from "./ui/entrance"
import { UIProvider } from "./ui/UIProvider"

/** Si une vue plante (donnée inattendue), un message à la place d'un écran vide ; le reste du logiciel continue. */
class ViewError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="empty" style={{ height: "100%" }}>
        <strong>Cette vue n'a pas pu s'afficher</strong>
        Une donnée inattendue l'en empêche. Le reste du logiciel fonctionne.
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn" onClick={() => window.location.assign("/")}>
            Revenir à l'accueil
          </button>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    )
  }
}

// Position de défilement de chaque vue, retrouvée quand on y revient (retour depuis une fiche d'appel, etc.)
const scrollMemory = new Map<string, number>()

function Pages() {
  const location = useLocation()
  const stack = useRef<HTMLDivElement>(null)

  // Comme un logiciel, on passe d'une vue à l'autre d'un coup (seules les miniatures volent d'une vue à l'autre) ;
  // les changements de filtre (?vue=…, ?categorie=…) restent dans la même vue.
  const view = new URLSearchParams(location.search).get("vue")
  const key = view ? `${location.pathname}?vue=${view}` : location.pathname

  useLayoutEffect(() => {
    const scroller = stack.current?.querySelector<HTMLElement>(".page-scroll")
    if (!scroller) return
    scroller.scrollTop = scrollMemory.get(key) ?? 0
    const save = () => scrollMemory.set(key, scroller.scrollTop)
    scroller.addEventListener("scroll", save, { passive: true })
    return () => scroller.removeEventListener("scroll", save)
  }, [key])

  return (
    <div ref={stack} className="page-stack">
      <div key={location.pathname} className="page">
        <ViewError>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/appels" element={<Calls />} />
            <Route path="/appels/:id" element={<CallDetail />} />
            <Route path="/bibliotheque" element={<Library />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </ViewError>
      </div>
    </div>
  )
}

/** Joue l'arrivée dans le logiciel dès que les données sont là (contenu caché le temps du chargement). */
function Entrance({ kind }: { kind: "login" | "startup" }) {
  const { loaded } = useWorkspace()
  const played = useRef(false)
  const [timedOut, setTimedOut] = useState(false)

  useLayoutEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 1500)
    return () => window.clearTimeout(t)
  }, [])

  useLayoutEffect(() => {
    const app = document.querySelector<HTMLElement>(".app")
    if (!app || played.current) return
    if (!loaded && !timedOut) {
      app.dataset.entering = "wait"
      return
    }
    played.current = true
    delete app.dataset.entering
    playEntrance(app, kind)
  }, [loaded, timedOut, kind])
  return null
}

function Workspace({ entrance }: { entrance: "login" | "startup" }) {
  return (
    <WorkspaceProvider>
      <UIProvider>
        <div
          className="app"
          onContextMenu={(e) => {
            // Comme une application : pas de menu du navigateur, sauf dans les champs et le texte sélectionnable
            if (!(e.target as HTMLElement).closest("input, textarea, .selectable")) e.preventDefault()
          }}
        >
          <Sidebar />
          <main className="main">
            <Pages />
            <StatusBar />
          </main>
          <TabBar />
        </div>
        <Entrance kind={entrance} />
        <CommandPalette />
        <NewCallSheet />
        <NewDocumentSheet />
        <DocumentPreview />
        <ContextMenu />
        <ConfirmDialog />
        <Toasts />
      </UIProvider>
    </WorkspaceProvider>
  )
}

/**
 * Écran de connexion et logiciel peuvent être affichés ensemble le temps d'une transition : à la connexion, l'écran
 * s'efface par-dessus le logiciel qui arrive ; à la déconnexion, il réapparaît par-dessus avant que le logiciel parte.
 */
function Gate() {
  const { session, ready } = useAuth()
  const [appMounted, setAppMounted] = useState(false)
  const [login, setLogin] = useState<LoginPhase | null>(null)
  const [entrance, setEntrance] = useState<"login" | "startup">("startup")
  const signedIn = useRef<boolean | null>(null)

  // Effet de mise en page : la bascule est appliquée avant que l'écran ne soit dessiné (pas d'image vide entre les deux)
  useLayoutEffect(() => {
    if (!ready) return
    const now = !!session
    const before = signedIn.current
    signedIn.current = now
    if (before === now) return
    if (before === null) {
      if (now) setAppMounted(true)
      else setLogin("idle")
    } else if (now) {
      setEntrance("login")
      setAppMounted(true)
      setLogin("leaving")
    } else {
      setLogin("entering")
    }
  }, [ready, session])

  if (!ready) return null
  return (
    <>
      {appMounted && (
        <BrowserRouter>
          <Workspace entrance={entrance} />
        </BrowserRouter>
      )}
      {login && (
        <LoginScreen
          phase={login}
          onDone={() => {
            if (login === "leaving") setLogin(null)
            if (login === "entering") {
              setAppMounted(false)
              setLogin("idle")
            }
          }}
        />
      )}
    </>
  )
}
export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
