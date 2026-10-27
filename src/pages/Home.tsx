import {
  ArrowRightIcon,
  CalendarBlankIcon,
  ClockIcon,
  FilePdfIcon,
  LinkSimpleIcon,
  PlusIcon,
  SquaresFourIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import { CallCard } from "../components/CallCard"
import { CallThumbnail } from "../components/CallThumbnail"
import { MiniCalendar, MonthCalendar } from "../components/Calendar"
import { Toolbar } from "../components/Chrome"
import { Avatar, Checkbox, Kbd, Segmented, TypeTag } from "../components/Controls"
import type { Call } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { duration, fmt, greeting, plural, relativeDay } from "../lib/format"
import { summaryExcerpt } from "../lib/summaryMarkdown"
import { useUI } from "../ui/UIProvider"

export function Home() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { calls, categories, documents, store, refresh } = useWorkspace()
  const { openNewCall, openNewDoc, setPreviewDocId } = useUI()
  const [callView, setCallView] = useState<"galerie" | "calendrier">("galerie")

  const past = calls.filter((c) => c.status !== "planned")
  const latest = past[0]
  const upcoming = useMemo(
    () => calls.filter((c) => c.status === "planned").sort((a, b) => a.date.localeCompare(b.date))[0],
    [calls],
  )
  const openActions = useMemo(
    () => calls.flatMap((c) => c.actions.filter((a) => !a.done).map((a) => ({ call: c, action: a }))),
    [calls],
  )

  const toggleAction = async (call: Call, actionId: string) => {
    await store.updateCall(call.id, {
      actions: call.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)),
    })
    refresh()
  }

  const today = fmt(new Date().toISOString(), "EEEE d MMMM")

  return (
    <>
      <Toolbar>
        <div className="toolbar-title">Accueil</div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group">
          <button type="button" className="btn" onClick={() => openNewDoc()}>
            <UploadSimpleIcon size={15} />
            Ajouter un document
          </button>
          <button type="button" className="btn btn--primary" onClick={() => openNewCall()}>
            <PlusIcon size={15} weight="bold" />
            Nouvel appel
            <Kbd>N</Kbd>
          </button>
        </div>
      </Toolbar>

      <div className="page-scroll">
        <div className="home">
          <header className="home-head">
            <span className="home-date">{today.charAt(0).toUpperCase() + today.slice(1)}</span>
            <h1>{greeting(session?.name ?? "")}</h1>
            <p className="home-sub">
              {plural(openActions.length, "action à faire", "actions à faire")}
              {upcoming && (
                <>
                  {" · "}prochain appel {relativeDay(upcoming.date).toLowerCase()}
                  {upcoming.time && ` à ${upcoming.time.replace(":", " h ")}`}
                </>
              )}
            </p>
          </header>

          <div className="home-grid">
            <div className="home-main">
              {latest ? (
                <section className="feature" role="link" onClick={() => navigate(`/appels/${latest.id}`)}>
                  <div className="feature-thumb">
                    <CallThumbnail call={latest} shared="feature" />
                  </div>
                  <div className="feature-body">
                    <span className="section-title">Dernier appel</span>
                    <h2>{latest.title || `Appel #${latest.number}`}</h2>
                    <div className="feature-meta">
                      <TypeTag type={latest.type} />
                      <span className="tnum">{relativeDay(latest.date)}</span>
                      {latest.durationMin ? <span className="tnum">· {duration(latest.durationMin)}</span> : null}
                    </div>
                    {summaryExcerpt(latest.summary) && <p className="feature-text">{summaryExcerpt(latest.summary)}</p>}
                    <div className="feature-foot">
                      {latest.actions.length > 0 && (
                        <div className="feature-progress">
                          <div className="progress-bar">
                            <span
                              style={{
                                width: `${(latest.actions.filter((a) => a.done).length / latest.actions.length) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="tnum">
                            {latest.actions.filter((a) => a.done).length}/{latest.actions.length} actions faites
                          </span>
                        </div>
                      )}
                      <span className="feature-open">
                        Ouvrir <ArrowRightIcon size={13} />
                      </span>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="feature feature--empty">
                  <div className="empty">
                    <strong>Aucun appel pour l'instant</strong>
                    Colle le résumé et la transcription de ton premier appel.
                    <button type="button" className="btn btn--primary" onClick={() => openNewCall()}>
                      <PlusIcon size={15} weight="bold" /> Nouvel appel
                    </button>
                  </div>
                </section>
              )}

              <section className="home-section">
                <div className="home-section-head">
                  <h3>Appels</h3>
                  <Segmented
                    value={callView}
                    onChange={setCallView}
                    options={[
                      { value: "galerie", label: "Galerie", icon: <SquaresFourIcon size={14} /> },
                      { value: "calendrier", label: "Calendrier", icon: <CalendarBlankIcon size={14} /> },
                    ]}
                  />
                  <span className="toolbar-spacer" />
                  <button type="button" className="link-btn" onClick={() => navigate("/appels")}>
                    Tout afficher
                  </button>
                </div>
                {callView === "galerie" ? (
                  <div className="gallery gallery--3">
                    {past.slice(0, 6).map((c) => (
                      <CallCard key={c.id} call={c} />
                    ))}
                  </div>
                ) : (
                  <div className="home-cal">
                    <MonthCalendar
                      calls={calls}
                      onOpen={(c) => navigate(`/appels/${c.id}`)}
                      onCreate={(date) => openNewCall({ date })}
                    />
                  </div>
                )}
              </section>

              <section className="home-section">
                <div className="home-section-head">
                  <h3>Bibliothèque</h3>
                  <span className="toolbar-spacer" />
                  <button type="button" className="link-btn" onClick={() => navigate("/bibliotheque")}>
                    Tout afficher
                  </button>
                </div>
                <div className="folders">
                  {categories.map((cat) => {
                    const count = documents.filter((d) => d.categoryId === cat.id).length
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className="folder"
                        data-color={cat.color}
                        onClick={() => navigate(`/bibliotheque?categorie=${cat.id}`)}
                      >
                        <span className="folder-glyph" data-color={cat.color}>
                          <svg viewBox="0 0 40 32" aria-hidden>
                            <path d="M2 6a3 3 0 0 1 3-3h10l3 3h17a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" />
                          </svg>
                        </span>
                        <span className="folder-name">{cat.name}</span>
                        <span className="folder-count tnum">{plural(count, "document", "documents")}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <aside className="home-aside">
              {upcoming && (
                <section className="panel upcoming" onClick={() => navigate(`/appels/${upcoming.id}`)}>
                  <span className="section-title">Prochain appel</span>
                  <div className="upcoming-row">
                    <div className="upcoming-date">
                      <span>{fmt(upcoming.date, "MMM").replace(".", "")}</span>
                      <b className="tnum">{format(new Date(`${upcoming.date}T12:00:00`), "d")}</b>
                    </div>
                    <div className="upcoming-info">
                      <strong>{upcoming.title || `Appel #${upcoming.number}`}</strong>
                      <span>
                        <ClockIcon size={12} /> {relativeDay(upcoming.date)}
                        {upcoming.time && ` · ${upcoming.time}`}
                      </span>
                      <span className="upcoming-people">
                        {upcoming.participants.map((p) => (
                          <Avatar key={p} name={p} size={18} />
                        ))}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              <section className="panel">
                <div className="panel-head">
                  <span className="section-title">À faire</span>
                  <span className="panel-count tnum">{openActions.length}</span>
                </div>
                {openActions.length === 0 ? (
                  <p className="panel-empty">Tout est fait. Bien joué.</p>
                ) : (
                  <ul className="todo">
                    {openActions.slice(0, 7).map(({ call, action }) => (
                      <li key={`${call.id}-${action.id}`}>
                        <Checkbox checked={action.done} onChange={() => toggleAction(call, action.id)} />
                        <button type="button" className="todo-text" onClick={() => navigate(`/appels/${call.id}?onglet=actions`)}>
                          {action.text}
                          <small>
                            #{call.number}
                            {action.owner && ` · ${action.owner}`}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <MiniCalendar calls={calls} onSelectDay={() => navigate("/appels?vue=calendrier")} />
              </section>

              <section className="panel">
                <div className="panel-head">
                  <span className="section-title">Ajoutés récemment</span>
                </div>
                <ul className="recent-docs">
                  {documents.slice(0, 4).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(d.categoryId ? `/bibliotheque?categorie=${d.categoryId}` : "/bibliotheque")
                          setPreviewDocId(d.id)
                        }}
                      >
                        <span className="recent-doc-icon" data-kind={d.kind}>
                          {d.kind === "link" ? <LinkSimpleIcon size={14} /> : <FilePdfIcon size={14} />}
                        </span>
                        <span className="recent-doc-name">{d.title}</span>
                        <span className="recent-doc-cat">{categories.find((c) => c.id === d.categoryId)?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}
