import { AnimatePresence, motion } from "framer-motion"
import { useLayoutEffect, useRef } from "react"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./auth/AuthProvider"
import { LoginScreen } from "./auth/LoginScreen"
import { Sidebar, StatusBar } from "./components/Chrome"
import { CommandPalette } from "./components/CommandPalette"
import { ConfirmDialog, ContextMenu, Toasts } from "./components/Overlays"
import { WorkspaceProvider } from "./data/workspace"
import { DocumentPreview } from "./features/DocumentPreview"
import { NewCallSheet } from "./features/NewCallSheet"
import { NewDocumentSheet } from "./features/NewDocumentSheet"
import { CallDetail } from "./pages/CallDetail"
import { Calls } from "./pages/Calls"
import { Home } from "./pages/Home"
import { Library } from "./pages/Library"
import { UIProvider } from "./ui/UIProvider"

// Position de défilement de chaque vue, retrouvée quand on y revient (retour depuis une fiche d'appel, etc.)
const scrollMemory = new Map<string, number>()

function Pages() {
  const location = useLocation()
  const stack = useRef<HTMLDivElement>(null)

  // Comme un logiciel, on passe d'une vue à l'autre d'un coup (seules les miniatures volent d'une vue à l'autre) ;
  // les changements de filtre (?vue=…, ?categorie=…) restent dans la même vue.
  useLayoutEffect(() => {
    const scroller = stack.current?.querySelector<HTMLElement>(".page-scroll")
    if (!scroller) return
    const key = location.pathname
    scroller.scrollTop = scrollMemory.get(key) ?? 0
    const save = () => scrollMemory.set(key, scroller.scrollTop)
    scroller.addEventListener("scroll", save, { passive: true })
    return () => scroller.removeEventListener("scroll", save)
  }, [location.pathname])

  return (
    <div ref={stack} className="page-stack">
      <div key={location.pathname} className="page">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/appels" element={<Calls />} />
          <Route path="/appels/:id" element={<CallDetail />} />
          <Route path="/bibliotheque" element={<Library />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </div>
  )
}

function Workspace() {
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
        </div>
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

function Gate() {
  const { session, ready } = useAuth()
  if (!ready) return null
  return (
    <AnimatePresence mode="wait">
      {session ? (
        <motion.div key="app" style={{ height: "100%" }} initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <BrowserRouter>
            <Workspace />
          </BrowserRouter>
        </motion.div>
      ) : (
        <motion.div key="login" style={{ height: "100%" }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.2 }}>
          <LoginScreen />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
