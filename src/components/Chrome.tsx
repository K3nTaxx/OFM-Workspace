import {
  BooksIcon,
  CalendarBlankIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  PlusIcon,
  SignOutIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { DEMO_MODE, useAuth } from "../auth/AuthProvider"
import { resetDemo } from "../data/demoStore"
import { useWorkspace } from "../data/workspace"
import { modKey, plural } from "../lib/format"
import { useUI } from "../ui/UIProvider"
import { CallThumbnail } from "./CallThumbnail"
import { Avatar } from "./Controls"

export function AppIcon({ size = 24 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 4.5v15l12.5-7.5z" />
      </svg>
    </span>
  )
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  sub,
  onContextMenu,
}: {
  icon: ReactNode
  label: string
  count?: number
  active?: boolean
  onClick: () => void
  sub?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      className={`nav-item${sub ? " nav-item--sub" : ""}`}
      data-active={active}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {icon}
      <span className="nav-item-label">{label}</span>
      {count !== undefined && <span className="nav-item-count">{count}</span>}
    </button>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { calls, categories, documents } = useWorkspace()
  const { setPaletteOpen, openNewCall, openMenu, openNewDoc } = useUI()
  const { session, signOut } = useAuth()

  const view = params.get("vue")
  const catParam = params.get("categorie")
  const recent = calls.filter((c) => c.status !== "planned").slice(0, 4)

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <AppIcon />
        <div className="app-name">
          Workspace OFM
          <small>{DEMO_MODE ? "Mode démo" : "Espace partagé"}</small>
        </div>
      </div>

      <button type="button" className="sidebar-search" onClick={() => setPaletteOpen(true)}>
        <MagnifyingGlassIcon size={14} />
        Rechercher
        <span className="kbd">{modKey} K</span>
      </button>

      <div className="sidebar-scroll">
        <div className="nav-group">
          <NavItem icon={<HouseIcon size={17} />} label="Accueil" active={pathname === "/"} onClick={() => navigate("/")} />
          <NavItem
            icon={<PlayCircleIcon size={17} />}
            label="Appels"
            count={calls.length}
            active={pathname.startsWith("/appels") && view !== "calendrier"}
            onClick={() => navigate("/appels")}
          />
          <NavItem
            icon={<CalendarBlankIcon size={17} />}
            label="Calendrier"
            active={pathname === "/appels" && view === "calendrier"}
            onClick={() => navigate("/appels?vue=calendrier")}
          />
          <NavItem
            icon={<BooksIcon size={17} />}
            label="Bibliothèque"
            count={documents.length}
            active={pathname === "/bibliotheque" && !catParam}
            onClick={() => navigate("/bibliotheque")}
          />
        </div>

        <div className="nav-group">
          <div className="nav-group-title">
            <span className="section-title">Appels récents</span>
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => openNewCall()} aria-label="Nouvel appel">
              <PlusIcon size={13} />
            </button>
          </div>
          {recent.map((c) => (
            <NavItem
              key={c.id}
              sub
              icon={<CallThumbnail call={c} className="nav-call-thumb" />}
              label={c.title || `Appel #${c.number}`}
              active={pathname === `/appels/${c.id}`}
              onClick={() => navigate(`/appels/${c.id}`)}
            />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-title">
            <span className="section-title">Bibliothèque</span>
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => openNewDoc()} aria-label="Ajouter un document">
              <PlusIcon size={13} />
            </button>
          </div>
          {categories.map((cat) => (
            <NavItem
              key={cat.id}
              sub
              icon={<span className="dot" data-color={cat.color} />}
              label={cat.name}
              count={documents.filter((d) => d.categoryId === cat.id).length}
              active={pathname === "/bibliotheque" && catParam === cat.id}
              onClick={() => navigate(`/bibliotheque?categorie=${cat.id}`)}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-foot">
        <button
          type="button"
          className="sidebar-user"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            openMenu({ x: r.left, y: r.top - (DEMO_MODE ? 104 : 72) }, [
              { heading: session?.email ?? "" },
              ...(DEMO_MODE
                ? [
                    {
                      label: "Réinitialiser la démo",
                      icon: <ArrowCounterClockwiseIcon size={15} />,
                      onSelect: () => {
                        resetDemo()
                        window.location.reload()
                      },
                    },
                  ]
                : []),
              { label: "Se déconnecter", icon: <SignOutIcon size={15} />, onSelect: signOut },
            ])
          }}
        >
          <Avatar name={session?.name ?? "?"} size={26} />
          <span className="sidebar-user-name">
            {session?.name}
            <small>Co-fondateur</small>
          </span>
        </button>
      </div>
    </aside>
  )
}

export function Toolbar({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <header className="toolbar">
      {children}
      {busy && (
        <div className="toolbar-progress">
          <span />
        </div>
      )}
    </header>
  )
}

export function StatusBar() {
  const { calls, documents } = useWorkspace()
  const { session } = useAuth()
  const analyzing = calls.filter((c) => c.status === "analyzing").length
  return (
    <footer className="statusbar">
      <span className="statusbar-item tnum">
        {plural(calls.length, "appel", "appels")} · {plural(documents.length, "document", "documents")}
      </span>
      {analyzing > 0 && (
        <span className="statusbar-item">
          <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
          Analyse IA en cours
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span className="statusbar-item">
        <span className="status-dot" data-tone={DEMO_MODE ? "demo" : undefined} />
        {DEMO_MODE ? "Mode démo · données locales" : "Synchronisé"}
      </span>
      <span className="statusbar-item">{session?.name}</span>
    </footer>
  )
}
