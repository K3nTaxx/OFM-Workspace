import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FileTextIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  QuotesIcon,
  TextAlignLeftIcon,
  TrashIcon,
  VideoCameraIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useCallActions } from "../components/CallCard"
import { CallThumbnail } from "../components/CallThumbnail"
import { Toolbar } from "../components/Chrome"
import { Avatar, Checkbox, Tag, ThemeTag, TypeTag } from "../components/Controls"
import { EditableBlock, InlineMarkdown, InlineText, Markdown, PasteBox, TokenField } from "../components/Inputs"
import { CALL_TYPES, OWNERS, PEOPLE, THEMES, THUMB_HUES, callType } from "../data/catalog"
import type { ActionItem, Call, CallSummary } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { ago, duration, fileSize, longDay, plural, transcriptFileName, wordCount, youtubeEmbed } from "../lib/format"
import { describeParsed, parseSummaryMarkdown, summaryToMarkdown } from "../lib/summaryMarkdown"
import { useUI } from "../ui/UIProvider"

type Tab = "resume" | "actions" | "transcription"

const emptySummary = (): CallSummary => ({
  essentials: "",
  highlights: [],
  decisions: [],
  sections: [],
  questions: [],
  quotes: [],
  vigilance: [],
})

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean)

export function CallDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { calls, documents, store, refresh, loaded } = useWorkspace()
  const { openMenu, toast, openNewDoc, setPreviewDocId } = useUI()
  const { menuFor } = useCallActions()
  const call = calls.find((c) => c.id === id)
  const tab = (params.get("onglet") as Tab) || "resume"
  const setTab = (t: Tab) => setParams(t === "resume" ? {} : { onglet: t }, { replace: true })
  const [editingVideo, setEditingVideo] = useState(false)

  if (!call) {
    return (
      <>
        <Toolbar>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate("/appels")} aria-label="Retour">
            <CaretLeftIcon size={15} />
          </button>
        </Toolbar>
        {loaded && (
          <div className="empty" style={{ paddingTop: 140 }}>
            <strong>Appel introuvable</strong>
            Il a peut-être été supprimé.
          </div>
        )}
      </>
    )
  }

  const save = async (patch: Partial<Call>) => {
    await store.updateCall(call.id, patch)
    refresh()
  }
  const saveSummary = (patch: Partial<CallSummary>) => save({ summary: { ...(call.summary ?? emptySummary()), ...patch } })

  const downloadTranscript = async () => {
    const text = await store.readTranscript(call)
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = call.transcript?.name ?? transcriptFileName(call.number)
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveTranscript = async (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const transcript = await store.uploadTranscript(call.id, blob, transcriptFileName(call.number))
    await save({ transcript, status: "ready" })
    toast("Transcription enregistrée")
  }

  // Résumé collé : remplace le résumé, garde les actions déjà cochées, met à jour les infos de « ## Infos »
  const applySummary = async (text: string) => {
    const { summary, actions, info } = parseSummaryMarkdown(text)
    const patch: Partial<Call> = { summary, status: "ready" }
    if (actions.length) {
      patch.actions = actions.map((a) => {
        const old = call.actions.find((o) => o.text === a.text)
        return old ? { ...a, id: old.id, done: old.done || a.done } : a
      })
    }
    if (info.title) patch.title = info.title
    if (info.date) patch.date = info.date
    if (info.time) patch.time = info.time
    if (info.durationMin) patch.durationMin = info.durationMin
    if (info.type) patch.type = info.type
    if (info.participants?.length) patch.participants = info.participants
    if (info.themes?.length) patch.themes = info.themes
    await save(patch)
    toast("Résumé enregistré")
  }

  const embed = youtubeEmbed(call.videoUrl)
  const linkedDocs = documents.filter((d) => d.callId === call.id)
  const openActions = call.actions.filter((a) => !a.done).length

  return (
    <>
      <Toolbar>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate(-1)} aria-label="Retour">
          <CaretLeftIcon size={15} />
        </button>
        <div className="toolbar-crumbs">
          <button type="button" onClick={() => navigate("/appels")}>
            Appels
          </button>
          <span className="sep">/</span>
          <span className="current">Appel #{call.number}</span>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group">
          {call.transcript && (
            <button type="button" className="btn" onClick={downloadTranscript}>
              <DownloadSimpleIcon size={15} />
              Transcription .txt
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Plus d'options"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              openMenu({ x: r.right - 200, y: r.bottom + 4 }, menuFor(call).filter((m) => m.label !== "Ouvrir"))
            }}
          >
            <DotsThreeIcon size={18} weight="bold" />
          </button>
        </div>
      </Toolbar>

      <div className="detail">
        <div className="page-scroll detail-main">
          <div className="detail-content">
            <div className="detail-hero">
              {embed ? (
                <div className="video-frame">
                  <iframe
                    src={embed}
                    title={call.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="detail-thumb">
                  <CallThumbnail call={call} shared />
                  <button type="button" className="detail-thumb-action" onClick={() => setEditingVideo(true)}>
                    <VideoCameraIcon size={15} />
                    Lier la vidéo YouTube
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {editingVideo && (
                <motion.div
                  className="video-link-row"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    autoFocus
                    className="input"
                    placeholder="Colle le lien YouTube de l'appel (non répertorié conseillé)"
                    defaultValue={call.videoUrl ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        save({ videoUrl: (e.target as HTMLInputElement).value.trim() || null })
                        setEditingVideo(false)
                      }
                      if (e.key === "Escape") setEditingVideo(false)
                    }}
                  />
                  <button type="button" className="btn btn--ghost btn--icon" onClick={() => setEditingVideo(false)} aria-label="Fermer">
                    <XIcon size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <InlineText className="detail-title" value={call.title} placeholder="Titre de l'appel" onSave={(title) => save({ title })} />
            <div className="detail-meta">
              <TypeTag type={call.type} />
              <span className="tnum">{longDay(call.date)}</span>
              {call.time && <span className="tnum">· {call.time.replace(":", " h ")}</span>}
              {call.durationMin ? <span className="tnum">· {duration(call.durationMin)}</span> : null}
              {call.participants.length > 0 && (
                <span className="detail-people">
                  {call.participants.map((p) => (
                    <Avatar key={p} name={p} size={20} />
                  ))}
                  <span>{call.participants.join(", ")}</span>
                </span>
              )}
            </div>

            <div className="tabs" role="tablist">
              {(
                [
                  ["resume", "Résumé", <TextAlignLeftIcon key="r" size={15} />],
                  ["actions", "Actions", <ListChecksIcon key="a" size={15} />],
                  ["transcription", "Transcription", <FileTextIcon key="t" size={15} />],
                ] as [Tab, string, ReactNode][]
              ).map(([value, label, icon]) => (
                <button key={value} type="button" role="tab" className="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
                  {icon}
                  {label}
                  {value === "actions" && call.actions.length > 0 && <span className="tab-count tnum">{openActions}</span>}
                  {tab === value && <motion.span layoutId="tab-underline" className="tab-underline" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.14 }}
              >
                {tab === "resume" && <SummaryView call={call} onSave={saveSummary} onApply={applySummary} />}
                {tab === "actions" && <ActionsView actions={call.actions} onChange={(actions) => save({ actions })} />}
                {tab === "transcription" && (
                  <TranscriptView call={call} onSave={saveTranscript} onDownload={downloadTranscript} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-section">
            <span className="section-title">Propriétés</span>
            <Prop label="Date">
              <input className="input input--bare tnum" type="date" value={call.date} onChange={(e) => e.target.value && save({ date: e.target.value })} />
            </Prop>
            <Prop label="Heure">
              <input className="input input--bare tnum" type="time" value={call.time ?? ""} onChange={(e) => save({ time: e.target.value || null })} />
            </Prop>
            <Prop label="Durée">
              <span className="prop-inline">
                <input
                  className="input input--bare tnum"
                  type="number"
                  min={0}
                  value={call.durationMin ?? ""}
                  placeholder="—"
                  onChange={(e) => save({ durationMin: e.target.value ? Number(e.target.value) : null })}
                />
                <span className="prop-unit">min</span>
              </span>
            </Prop>
            <Prop label="Type">
              <button
                type="button"
                className="prop-button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openMenu(
                    { x: r.left, y: r.bottom + 4 },
                    CALL_TYPES.map((t) => ({
                      label: t.label,
                      checked: t.id === call.type,
                      icon: <span className="dot" data-color={t.color} />,
                      onSelect: () => save({ type: t.id }),
                    })),
                  )
                }}
              >
                <Tag color={callType(call.type).color}>{callType(call.type).label}</Tag>
                <CaretDownIcon size={11} />
              </button>
            </Prop>
            <Prop label="Intervenants" top>
              <TokenField
                values={call.participants}
                onChange={(participants) => save({ participants })}
                suggestions={PEOPLE}
                renderToken={(v, remove) => <Tag onRemove={remove}>{v}</Tag>}
              />
            </Prop>
            <Prop label="Thèmes" top>
              <TokenField
                values={call.themes}
                onChange={(themes) => save({ themes })}
                suggestions={THEMES.map((t) => t.label)}
                renderToken={(v, remove) => <ThemeTag label={v} onRemove={remove} />}
              />
            </Prop>
            <Prop label="Vidéo">
              {call.videoUrl ? (
                <span className="prop-inline">
                  <a href={call.videoUrl} target="_blank" rel="noreferrer" className="prop-link">
                    {call.videoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                  <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => save({ videoUrl: null })} aria-label="Retirer la vidéo">
                    <XIcon size={12} />
                  </button>
                </span>
              ) : (
                <button type="button" className="prop-button prop-button--muted" onClick={() => setEditingVideo(true)}>
                  Ajouter un lien
                </button>
              )}
            </Prop>
          </div>

          <div className="inspector-section">
            <span className="section-title">Miniature</span>
            <div className="hue-picker">
              {THUMB_HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="hue-swatch"
                  data-active={call.hue === h}
                  style={{ ["--h" as string]: h }}
                  onClick={() => save({ hue: h })}
                  aria-label={`Teinte ${h}`}
                />
              ))}
            </div>
          </div>

          <div className="inspector-section">
            <span className="section-title">Fichiers</span>
            {call.transcript ? (
              <button type="button" className="file-row" onClick={downloadTranscript}>
                <span className="file-row-icon">
                  <FileTextIcon size={16} />
                </span>
                <span className="file-row-text">
                  {call.transcript.name}
                  <small>Transcription · {call.transcript.size ? fileSize(call.transcript.size) : "texte"}</small>
                </span>
                <DownloadSimpleIcon size={14} className="file-row-end" />
              </button>
            ) : (
              <p className="inspector-empty">Pas encore de transcription.</p>
            )}
            {linkedDocs.map((d) => (
              <button
                key={d.id}
                type="button"
                className="file-row"
                onClick={() => {
                  navigate(d.categoryId ? `/bibliotheque?categorie=${d.categoryId}` : "/bibliotheque")
                  setPreviewDocId(d.id)
                }}
              >
                <span className="file-row-icon" data-kind={d.kind}>
                  {d.kind === "link" ? <LinkSimpleIcon size={16} /> : <FilePdfIcon size={16} />}
                </span>
                <span className="file-row-text">
                  {d.title}
                  <small>{d.kind === "link" ? "Lien" : fileSize(d.size)}</small>
                </span>
              </button>
            ))}
            <button type="button" className="btn btn--ghost btn--sm inspector-add" onClick={() => openNewDoc({ callId: call.id })}>
              <PlusIcon size={13} /> Ajouter un document lié
            </button>
          </div>

          <div className="inspector-section inspector-section--muted">
            <Prop label="Créé par">{call.createdBy ? call.createdBy.charAt(0).toUpperCase() + call.createdBy.slice(1) : "—"}</Prop>
            <Prop label="Modifié">{ago(call.updatedAt)}</Prop>
          </div>
        </aside>
      </div>
    </>
  )
}

function Prop({ label, children, top }: { label: string; children: ReactNode; top?: boolean }) {
  return (
    <div className="prop" data-top={top}>
      <span className="prop-label">{label}</span>
      <div className="prop-value">{children}</div>
    </div>
  )
}

/* ---------------- Résumé ---------------- */

function SummaryView({
  call,
  onSave,
  onApply,
}: {
  call: Call
  onSave: (patch: Partial<CallSummary>) => void
  onApply: (markdown: string) => Promise<void>
}) {
  const { toast } = useUI()
  const [replacing, setReplacing] = useState(false)
  const s = call.summary

  if (!s || replacing) {
    return (
      <SummaryPaste
        initial={s ? summaryToMarkdown(call) : ""}
        onApply={async (text) => {
          await onApply(text)
          setReplacing(false)
        }}
        onCancel={s ? () => setReplacing(false) : undefined}
        onManual={s ? undefined : () => onSave(emptySummary())}
      />
    )
  }

  return (
    <div className="summary">
      <div className="summary-tools">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            navigator.clipboard.writeText(summaryToMarkdown(call))
            toast("Résumé copié")
          }}
        >
          <CopyIcon size={13} /> Copier
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplacing(true)}>
          <ArrowsClockwiseIcon size={13} /> Remplacer
        </button>
      </div>
      <div className="essentials">
        <span className="section-title">L'essentiel</span>
        <EditableBlock
          value={s.essentials}
          placeholder="Le résumé en quelques phrases…"
          rows={4}
          onSave={(essentials) => onSave({ essentials })}
          render={(v) => (
            <p className="essentials-text selectable">
              <InlineMarkdown>{v}</InlineMarkdown>
            </p>
          )}
        />
      </div>

      {s.highlights.length > 0 && (
        <div className="highlights">
          {s.highlights.map((h, i) => (
            <div key={i} className="highlight">
              <span>{h.label}</span>
              <strong className="tnum">{h.value}</strong>
            </div>
          ))}
        </div>
      )}

      <SummaryList
        title="Décisions"
        icon={<CheckCircleIcon size={15} />}
        items={s.decisions}
        onSave={(decisions) => onSave({ decisions })}
      />

      {s.sections.map((section, i) => (
        <section key={i} className="summary-section">
          <div className="summary-section-head">
            <span className="summary-index tnum">{String(i + 1).padStart(2, "0")}</span>
            <InlineText
              className="summary-section-title"
              value={section.title}
              onSave={(title) => onSave({ sections: s.sections.map((x, j) => (j === i ? { ...x, title } : x)) })}
            />
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm summary-section-del"
              aria-label="Supprimer la section"
              onClick={() => onSave({ sections: s.sections.filter((_, j) => j !== i) })}
            >
              <TrashIcon size={13} />
            </button>
          </div>
          <EditableBlock
            value={section.body}
            rows={10}
            placeholder="Contenu de la section…"
            onSave={(body) => onSave({ sections: s.sections.map((x, j) => (j === i ? { ...x, body } : x)) })}
            render={(v) => <Markdown>{v}</Markdown>}
          />
        </section>
      ))}
      <button
        type="button"
        className="btn btn--ghost btn--sm add-section"
        onClick={() => onSave({ sections: [...s.sections, { title: "Nouvelle section", body: "" }] })}
      >
        <PlusIcon size={13} /> Ajouter une section
      </button>

      <SummaryList title="Questions pour le prochain appel" icon={<span className="glyph">?</span>} items={s.questions} onSave={(questions) => onSave({ questions })} />
      <SummaryList title="Phrases marquantes" icon={<QuotesIcon size={15} />} items={s.quotes} quote onSave={(quotes) => onSave({ quotes })} />
      <SummaryList title="Points de vigilance" icon={<WarningCircleIcon size={15} />} items={s.vigilance} tone="warn" onSave={(vigilance) => onSave({ vigilance })} />
    </div>
  )
}

function SummaryPaste({
  initial,
  onApply,
  onCancel,
  onManual,
}: {
  initial: string
  onApply: (markdown: string) => Promise<void>
  onCancel?: () => void
  onManual?: () => void
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => (text.trim() ? parseSummaryMarkdown(text) : null), [text])
  return (
    <div className="paste-panel">
      <PasteBox
        label="Résumé"
        icon={<TextAlignLeftIcon size={15} />}
        value={text}
        onChange={setText}
        placeholder="Colle ici le résumé de l'appel"
        rows={14}
        autoFocus={!!onCancel}
        selectOnFocus={!!initial}
        status={
          parsed && (
            <>
              <CheckIcon size={12} weight="bold" />
              {describeParsed(parsed).join(" · ") || "Texte libre"}
            </>
          )
        }
      />
      <div className="paste-panel-foot">
        {onManual && (
          <button type="button" className="link-btn" onClick={onManual}>
            ou écrire le résumé à la main
          </button>
        )}
        <span className="spacer" />
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!parsed || busy}
          onClick={async () => {
            setBusy(true)
            await onApply(text).finally(() => setBusy(false))
          }}
        >
          {busy && <span className="spinner" />}
          Enregistrer le résumé
        </button>
      </div>
    </div>
  )
}

function SummaryList({
  title,
  icon,
  items,
  onSave,
  quote,
  tone,
}: {
  title: string
  icon: ReactNode
  items: string[]
  onSave: (v: string[]) => void
  quote?: boolean
  tone?: "warn"
}) {
  return (
    <section className="summary-list" data-tone={tone}>
      <div className="summary-list-head">
        {icon}
        <span>{title}</span>
      </div>
      <EditableBlock
        value={items.join("\n")}
        placeholder="Rien pour l'instant — double-clic pour ajouter (une ligne par élément)"
        rows={Math.max(3, items.length + 1)}
        onSave={(v) => onSave(lines(v))}
        render={() =>
          quote ? (
            <div className="quotes selectable">
              {items.map((q, i) => (
                <blockquote key={i}>
                  <InlineMarkdown>{q}</InlineMarkdown>
                </blockquote>
              ))}
            </div>
          ) : (
            <ul className="bullets selectable">
              {items.map((x, i) => (
                <li key={i}>
                  <InlineMarkdown>{x}</InlineMarkdown>
                </li>
              ))}
            </ul>
          )
        }
      />
    </section>
  )
}

function SummarySkeleton() {
  return (
    <div className="skeleton">
      {[92, 78, 85, 40, 88, 70, 60].map((w, i) => (
        <span key={i} style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

/* ---------------- Actions ---------------- */

function ActionsView({ actions, onChange }: { actions: ActionItem[]; onChange: (a: ActionItem[]) => void }) {
  const { openMenu } = useUI()
  const [draft, setDraft] = useState("")
  const done = actions.filter((a) => a.done).length

  const add = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...actions, { id: crypto.randomUUID(), text, done: false }])
    setDraft("")
  }

  return (
    <div className="actions-view">
      {actions.length > 0 && (
        <div className="actions-progress">
          <div className="progress-bar">
            <span style={{ width: `${(done / actions.length) * 100}%` }} />
          </div>
          <span className="tnum">
            {done} sur {actions.length} faites
          </span>
        </div>
      )}
      <ul className="action-list">
        <AnimatePresence initial={false}>
          {actions.map((a) => (
            <motion.li
              key={a.id}
              layout
              className="action-row"
              data-done={a.done}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Checkbox checked={a.done} onChange={(v) => onChange(actions.map((x) => (x.id === a.id ? { ...x, done: v } : x)))} />
              <InlineText
                className="action-text"
                value={a.text}
                onSave={(text) => onChange(actions.map((x) => (x.id === a.id ? { ...x, text } : x)))}
              />
              <button
                type="button"
                className="owner-chip"
                data-empty={!a.owner}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openMenu({ x: r.left, y: r.bottom + 4 }, [
                    { heading: "Qui s'en occupe ?" },
                    ...OWNERS.map((o) => ({
                      label: o,
                      checked: a.owner === o,
                      onSelect: () => onChange(actions.map((x) => (x.id === a.id ? { ...x, owner: o } : x))),
                    })),
                    { separator: true },
                    { label: "Personne", onSelect: () => onChange(actions.map((x) => (x.id === a.id ? { ...x, owner: undefined } : x))) },
                  ])
                }}
              >
                {a.owner ?? "Assigner"}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm action-del"
                aria-label="Supprimer"
                onClick={() => onChange(actions.filter((x) => x.id !== a.id))}
              >
                <XIcon size={12} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="action-add">
        <PlusIcon size={14} />
        <input
          className="inline-text"
          placeholder="Ajouter une action… (Entrée)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
      </div>
    </div>
  )
}

/* ---------------- Transcription ---------------- */

function TranscriptView({
  call,
  onSave,
  onDownload,
}: {
  call: Call
  onSave: (text: string) => Promise<void>
  onDownload: () => void
}) {
  const { store } = useWorkspace()
  const { toast } = useUI()
  const [text, setText] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    let alive = true
    setText(null)
    store.readTranscript(call).then((t) => alive && setText(t))
    return () => {
      alive = false
    }
  }, [store, call])

  const rows = useMemo(() => {
    if (!text) return []
    return text.split("\n").map((line) => {
      const m = line.match(/^(Speaker \d+|[A-ZÉÈ][\wÀ-ÿ.\- ]{1,24}):\s*(.*)$/)
      return m ? { speaker: m[1], body: m[2] } : { speaker: null, body: line }
    })
  }, [text])

  if (!call.transcript || replacing) {
    return (
      <TranscriptPaste
        number={call.number}
        onCancel={call.transcript ? () => setReplacing(false) : undefined}
        onApply={async (t) => {
          await onSave(t)
          setReplacing(false)
        }}
      />
    )
  }

  const nq = q.trim().toLowerCase()
  const matches = nq ? rows.filter((r) => r.body.toLowerCase().includes(nq)).length : 0
  const highlight = (s: string) => {
    if (!nq) return s
    const parts = s.split(new RegExp(`(${nq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
    return parts.map((p, i) => (p.toLowerCase() === nq ? <mark key={i}>{p}</mark> : p))
  }

  return (
    <div className="transcript">
      <div className="transcript-bar">
        <label className="search">
          <MagnifyingGlassIcon size={14} />
          <input className="input" placeholder="Rechercher dans la transcription" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {nq && <span className="transcript-count tnum">{matches} passage{matches > 1 ? "s" : ""}</span>}
        <span className="toolbar-spacer" />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            if (text) navigator.clipboard.writeText(text)
            toast("Transcription copiée")
          }}
        >
          <CopyIcon size={13} /> Copier
        </button>
        <button type="button" className="btn btn--sm" onClick={onDownload}>
          <DownloadSimpleIcon size={13} /> .txt
        </button>
        <button type="button" className="btn btn--sm" onClick={() => setReplacing(true)}>
          <ArrowsClockwiseIcon size={13} /> Remplacer
        </button>
      </div>
      {text === null ? (
        <SummarySkeleton />
      ) : (
        <div className="transcript-body selectable">
          {rows.map((r, i) =>
            !r.body && !r.speaker ? (
              <div key={i} className="transcript-gap" />
            ) : nq && !r.body.toLowerCase().includes(nq) ? null : (
              <p key={i} className="transcript-line">
                {r.speaker && (
                  <span className="speaker" data-speaker={r.speaker.replace(/\D/g, "") || "x"}>
                    {r.speaker}
                  </span>
                )}
                <span>{highlight(r.body)}</span>
              </p>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function TranscriptPaste({
  number,
  onApply,
  onCancel,
}: {
  number: number
  onApply: (text: string) => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <div className="paste-panel">
      <PasteBox
        label="Transcription"
        icon={<FileTextIcon size={15} />}
        value={text}
        onChange={setText}
        placeholder="Colle ici la transcription, ou glisse le fichier .txt"
        rows={14}
        autoFocus={!!onCancel}
        status={
          <>
            <CheckIcon size={12} weight="bold" />
            {plural(wordCount(text), "mot", "mots")} · {transcriptFileName(number)}
          </>
        }
      />
      <div className="paste-panel-foot">
        <span className="spacer" />
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true)
            await onApply(text).finally(() => setBusy(false))
          }}
        >
          {busy && <span className="spinner" />}
          Enregistrer la transcription
        </button>
      </div>
    </div>
  )
}
