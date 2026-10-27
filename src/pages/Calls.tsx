import { CalendarBlankIcon, FunnelSimpleIcon, MagnifyingGlassIcon, PlayCircleIcon, PlusIcon, SquaresFourIcon } from "@phosphor-icons/react"
import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CallCard } from "../components/CallCard"
import { MonthCalendar } from "../components/Calendar"
import { Toolbar } from "../components/Chrome"
import { Kbd, Segmented } from "../components/Controls"
import { CALL_TYPES } from "../data/catalog"
import type { Call, CallType } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { fmt, parseDay } from "../lib/format"
import { useUI } from "../ui/UIProvider"
import { useRemembered } from "../ui/remember"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

export function Calls() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { calls } = useWorkspace()
  const { openNewCall, openMenu } = useUI()
  const [q, setQ] = useRemembered("appels.recherche", "")
  const [type, setType] = useRemembered<CallType | null>("appels.type", null)

  const view = params.get("vue") === "calendrier" ? "calendrier" : "galerie"
  const setView = (v: "galerie" | "calendrier") => setParams(v === "calendrier" ? { vue: "calendrier" } : {})

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return calls.filter(
      (c) =>
        (!type || c.type === type) &&
        (!nq || norm(`${c.title} ${c.themes.join(" ")} ${c.participants.join(" ")} #${c.number}`).includes(nq)),
    )
  }, [calls, q, type])

  const groups = useMemo(() => {
    const planned = filtered.filter((c) => c.status === "planned").sort((a, b) => a.date.localeCompare(b.date))
    const byMonth = new Map<string, Call[]>()
    for (const c of filtered.filter((c) => c.status !== "planned")) {
      const key = c.date.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), c])
    }
    const months = [...byMonth.entries()].map(([key, list]) => {
      const label = fmt(`${key}-01`, "MMMM yyyy")
      return { key, label: label.charAt(0).toUpperCase() + label.slice(1), list }
    })
    return planned.length ? [{ key: "planned", label: "À venir", list: planned }, ...months] : months
  }, [filtered])

  return (
    <>
      <Toolbar>
        <div className="toolbar-title">
          {view === "calendrier" ? "Calendrier" : "Appels"} <small className="tnum">{filtered.length}</small>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group">
          <Segmented
            className="desktop-only"
            value={view}
            onChange={setView}
            options={[
              { value: "galerie", label: "Galerie", icon: <SquaresFourIcon size={14} /> },
              { value: "calendrier", label: "Calendrier", icon: <CalendarBlankIcon size={14} /> },
            ]}
          />
          <label className="search">
            <MagnifyingGlassIcon size={14} />
            <input className="input" placeholder="Rechercher un appel" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button
            type="button"
            className={`btn ${type ? "" : "btn--ghost"}`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              openMenu({ x: r.left, y: r.bottom + 4 }, [
                { heading: "Type d'appel" },
                { label: "Tous", checked: !type, onSelect: () => setType(null) },
                ...CALL_TYPES.map((t) => ({ label: t.label, checked: type === t.id, onSelect: () => setType(t.id) })),
              ])
            }}
          >
            <FunnelSimpleIcon size={15} />
            {type ? CALL_TYPES.find((t) => t.id === type)?.label : "Filtrer"}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => openNewCall()}>
            <PlusIcon size={15} weight="bold" />
            Nouvel appel
            <Kbd>N</Kbd>
          </button>
        </div>
      </Toolbar>

      {view === "calendrier" ? (
        <div className="calls-cal">
          <MonthCalendar
            calls={filtered}
            initialMonth={/^\d{4}-\d{2}$/.test(params.get("mois") ?? "") ? parseDay(`${params.get("mois")}-01`) : undefined}
            onOpen={(c) => navigate(`/appels/${c.id}`)}
            onCreate={(date) => openNewCall({ date })}
          />
        </div>
      ) : (
        <div className="page-scroll">
          <div className="calls">
            {groups.length === 0 && (
              <div className="empty" style={{ paddingTop: 120 }}>
                <PlayCircleIcon className="empty-icon" size={44} weight="thin" />
                <strong>{q || type ? "Aucun appel ne correspond" : "Aucun appel"}</strong>
                {q || type ? "Essaie une autre recherche." : "Crée ton premier appel à partir d'une transcription."}
              </div>
            )}
            {groups.map((g) => (
              <section key={g.key} className="calls-group">
                <h3 className="calls-group-title">
                  {g.label} <span className="tnum">{g.list.length}</span>
                </h3>
                <div className="gallery">
                  {g.list.map((c) => (
                    <CallCard key={c.id} call={c} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
