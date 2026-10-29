import {
  ArrowCounterClockwiseIcon,
  BooksIcon,
  CalendarBlankIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlayCircleIcon,
  PlusIcon,
  SignOutIcon,
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

/** Menu du profil (e-mail, déconnexion) : depuis le pied de la barre latérale, ou l'avatar en haut sur téléphone. */
function useProfileMenu() {
  const { openMenu } = useUI()
  const { session, signOut } = useAuth()
  return (r: DOMRect, above: boolean) =>
    openMenu({ x: r.left, y: above ? r.top - (DEMO_MODE ? 104 : 72) : r.bottom + 6 }, [
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
      { label: "Se déconnecter", icon: <SignOutIcon size={15} />, danger: true, onSelect: signOut },
    ])
}

/** Avatar du compte connecté (en haut de l'accueil sur téléphone). */
export function ProfileButton({ className = "" }: { className?: string }) {
  const { session } = useAuth()
  const open = useProfileMenu()
  return (
    <button type="button" className={`profile-btn ${className}`} aria-label="Mon compte" onClick={(e) => open(e.currentTarget.getBoundingClientRect(), false)}>
      <Avatar name={session?.name ?? "?"} size={30} />
    </button>
  )
}

/**
 * Barre d'onglets du téléphone (façon iOS) : Accueil, Appels (galerie ou calendrier), Notes, Bibliothèque, Rechercher.
 * Toucher l'onglet déjà ouvert remonte la page tout en haut.
 */
export function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { paletteOpen, setPaletteOpen } = useUI()
  const view = params.get("vue")
  const tabs = [
    { key: "home", label: "Accueil", Icon: HouseIcon, active: pathname === "/", to: "/" },
    { key: "calls", label: "Appels", Icon: PlayCircleIcon, active: pathname.startsWith("/appels"), to: view === "calendrier" ? "/appels?vue=calendrier" : "/appels" },
    { key: "notes", label: "Notes", Icon: NotePencilIcon, active: pathname === "/notes", to: "/notes" },
    { key: "lib", label: "Bibliothèque", Icon: BooksIcon, active: pathname === "/bibliotheque", to: "/bibliotheque" },
    { key: "search", label: "Rechercher", Icon: MagnifyingGlassIcon, active: paletteOpen, to: null },
  ]
  return (
    <nav className="tabbar" aria-label="Navigation">
      {tabs.map(({ key, label, Icon, active, to }) => (
        <button
          key={key}
          type="button"
          className="tabbar-item"
          data-active={active}
          onClick={() => {
            if (!to) return setPaletteOpen(true)
            if (active && pathname === to.split("?")[0]) {
              document.querySelector(".page-scroll")?.scrollTo({ top: 0, behavior: "smooth" })
              if (pathname.startsWith("/appels/")) navigate("/appels")
            } else navigate(to)
          }}
        >
          <Icon size={25} weight={active ? "fill" : "regular"} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { calls, documents, notes } = useWorkspace()
  const { setPaletteOpen, openNewCall } = useUI()
  const { session } = useAuth()
  const openProfile = useProfileMenu()

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
          <NavItem
            icon={<NotePencilIcon size={17} />}
            label="Notes"
            count={notes.length}
            active={pathname === "/notes"}
            onClick={() => navigate("/notes")}
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
          onClick={(e) => openProfile(e.currentTarget.getBoundingClientRect(), true)}
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
