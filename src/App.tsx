import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
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

function Pages() {
  const location = useLocation()
  // Une page = un chemin ; les changements de filtre (?vue=…) ne rejouent pas l'animation.
  return (
    <div className="page-stack">
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          className="page"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/appels" element={<Calls />} />
            <Route path="/appels/:id" element={<CallDetail />} />
            <Route path="/bibliotheque" element={<Library />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Workspace() {
  return (
    <WorkspaceProvider>
      <UIProvider>
        <LayoutGroup>
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
        </LayoutGroup>
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
