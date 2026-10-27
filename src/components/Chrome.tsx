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

/** Logo « OFM WORKSPACE » (PNG généré par outils/logo.py), sans encadré. */
export function Logo() {
  return <img className="brand-logo" src="/logo.png" alt="OFM Workspace" draggable={false} />
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
  const { calls, documents } = useWorkspace()
  const { setPaletteOpen, openNewCall, openMenu } = useUI()
  const { session, signOut } = useAuth()

  const view = params.get("vue")
  const recent = calls.filter((c) => c.status !== "planned").slice(0, 4)

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Logo />
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
            active={pathname === "/bibliotheque"}
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
              icon={<CallThumbnail call={c} shared="recent" className="nav-call-thumb" />}
              label={c.title || `Appel #${c.number}`}
              active={pathname === `/appels/${c.id}`}
              onClick={() => navigate(`/appels/${c.id}`)}
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
  return (
    <footer className="statusbar">
      <span className="statusbar-item tnum">
        {plural(calls.length, "appel", "appels")} · {plural(documents.length, "document", "documents")}
      </span>
      <span style={{ flex: 1 }} />
      <span className="statusbar-item">
        <span className="status-dot" data-tone={DEMO_MODE ? "demo" : undefined} />
        {DEMO_MODE ? "OFM Workspace" : "Synchronisé"}
      </span>
      <span className="statusbar-item">{session?.name}</span>
    </footer>
  )
}
