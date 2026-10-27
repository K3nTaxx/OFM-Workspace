import { CheckIcon, FileTextIcon, TextAlignLeftIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CallThumbnail } from "../components/CallThumbnail"
import { Tag, ThemeTag } from "../components/Controls"
import { PasteBox, TokenField } from "../components/Inputs"
import { Sheet } from "../components/Overlays"
import { CALL_TYPES, PEOPLE, THEMES, THUMB_HUES } from "../data/catalog"
import type { Call, CallType } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { isValidDay, modKey, plural, transcriptFileName, wordCount } from "../lib/format"
import { describeParsed, parseSummaryMarkdown, type ParsedSummary } from "../lib/summaryMarkdown"
import { anyLayerOpen, isTyping } from "../ui/layers"
import { useUI } from "../ui/UIProvider"

export function NewCallSheet() {
  const { newCall, closeNewCall, openNewCall, toast } = useUI()
  const { calls, store, refresh } = useWorkspace()
  const navigate = useNavigate()

  const [summaryText, setSummaryText] = useState("")
  const [parsed, setParsed] = useState<ParsedSummary | null>(null)
  const [transcriptText, setTranscriptText] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [durationMin, setDurationMin] = useState<number | null>(null)
  const [type, setType] = useState<CallType>("mentorat")
  const [participants, setParticipants] = useState<string[]>(["Jules"])
  const [themes, setThemes] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState("")
  const [busy, setBusy] = useState(false)
  // Appel déjà créé lors d'un essai précédent (si l'envoi de la transcription avait échoué) : on ne le recrée pas
  const created = useRef<Call | null>(null)

  const nextNumber = useMemo(() => Math.max(0, ...calls.map((c) => c.number)) + 1, [calls])
  const hue = THUMB_HUES[(nextNumber - 1) % THUMB_HUES.length]

  useEffect(() => {
    if (!newCall) return
    setSummaryText("")
    setParsed(null)
    setTranscriptText("")
    setTitle("")
    created.current = null
    setDate(newCall.date ?? format(new Date(), "yyyy-MM-dd"))
    setTime("")
    setDurationMin(null)
    setType("mentorat")
    setParticipants(["Jules"])
    setThemes([])
    setVideoUrl("")
    setBusy(false)
  }, [newCall])

  // Raccourci global « N » pour ouvrir la feuille (hors champs de saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target) || anyLayerOpen()) return
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openNewCall()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openNewCall])

  // Le résumé collé remplit tout seul titre, date, type, intervenants et thèmes (section « ## Infos »)
  const onSummary = (text: string) => {
    setSummaryText(text)
    if (!text.trim()) return setParsed(null)
    const p = parseSummaryMarkdown(text)
    setParsed(p)
    const { info } = p
    if (info.title) setTitle(info.title)
    if (info.date) setDate(info.date)
    if (info.time) setTime(info.time)
    if (info.durationMin) setDurationMin(info.durationMin)
    if (info.type) setType(info.type)
    if (info.participants?.length) setParticipants(info.participants)
    if (info.themes?.length) setThemes(info.themes)
  }

  const hasTranscript = transcriptText.trim().length > 0
  const isFuture = date > format(new Date(), "yyyy-MM-dd")
  const planned = isFuture && !parsed && !hasTranscript

  const submit = async () => {
    if (busy || !isValidDay(date)) return
    setBusy(true)
    try {
      const call = (created.current ??= await store.createCall({
        title: title.trim(),
        date,
        time: time || null,
        durationMin,
        type,
        participants,
        themes,
        videoUrl: videoUrl.trim() || null,
        hue,
        summary: parsed?.summary ?? null,
        actions: parsed?.actions ?? [],
        status: planned ? "planned" : "ready",
      }))
      if (hasTranscript) {
        const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" })
        const transcript = await store.uploadTranscript(call.id, blob, transcriptFileName(call.number))
        await store.updateCall(call.id, { transcript })
      }
      await refresh()
      closeNewCall()
      navigate(`/appels/${call.id}`)
      toast(`Appel #${call.number} créé`)
    } catch (e) {
      console.error(e)
      toast(created.current ? "Appel créé, mais la transcription n'a pas pu être envoyée. Réessaie." : "Impossible de créer l'appel. Vérifie ta connexion.", "error")
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={!!newCall}
      onClose={closeNewCall}
      title="Nouvel appel"
      width={840}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeNewCall}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !isValidDay(date)} onClick={submit}>
            {busy && <span className="spinner" />}
            Créer l'appel
            <span className="kbd">{modKey} ↵</span>
          </button>
        </>
      }
    >
      <div
        className="newcall"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit()
        }}
      >
        <div className="newcall-pastes">
          <PasteBox
            label="Résumé"
            icon={<TextAlignLeftIcon size={15} />}
            value={summaryText}
            onChange={onSummary}
            placeholder="Colle ici le résumé de l'appel"
            status={
              parsed && (
                <>
                  <CheckIcon size={12} weight="bold" />
                  {describeParsed(parsed).join(" · ") || "Texte libre"}
                </>
              )
            }
          />
          <PasteBox
            label="Transcription"
            icon={<FileTextIcon size={15} />}
            value={transcriptText}
            onChange={setTranscriptText}
            placeholder="Colle ici la transcription, ou glisse le fichier .txt"
            status={
              <>
                <CheckIcon size={12} weight="bold" />
                {plural(wordCount(transcriptText), "mot", "mots")} · {transcriptFileName(nextNumber)}
              </>
            }
          />
        </div>

        <div className="newcall-details">
          <div className="newcall-preview">
            <CallThumbnail call={{ id: "preview", number: nextNumber, title: title || "Nouvel appel", hue, status: planned ? "planned" : "ready" }} />
          </div>

          <div className="newcall-form">
            <div className="form-row">
              <label className="field" style={{ flex: 2 }}>
                <span className="field-label">Titre</span>
                <input className="input" placeholder={`Appel #${nextNumber}`} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Date</span>
                <input className="input tnum" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field" style={{ maxWidth: 100 }}>
                <span className="field-label">Heure</span>
                <input className="input tnum" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className="field" style={{ maxWidth: 84 }}>
                <span className="field-label">Durée</span>
                <span className="input-unit">
                  <input
                    className="input tnum"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={durationMin ?? ""}
                    onChange={(e) => setDurationMin(e.target.value ? Number(e.target.value) : null)}
                  />
                  <span>min</span>
                </span>
              </label>
            </div>

            <div className="field">
              <span className="field-label">Type</span>
              <div className="choice-row">
                {CALL_TYPES.map((t) => (
                  <button key={t.id} type="button" className="choice" data-active={type === t.id} onClick={() => setType(t.id)}>
                    <span className="dot" data-color={t.color} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="field" style={{ flex: 1 }}>
                <span className="field-label">Intervenants</span>
                <TokenField values={participants} onChange={setParticipants} suggestions={PEOPLE} renderToken={(v, remove) => <Tag onRemove={remove}>{v}</Tag>} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <span className="field-label">Thèmes</span>
                <TokenField
                  values={themes}
                  onChange={setThemes}
                  suggestions={THEMES.map((t) => t.label)}
                  renderToken={(v, remove) => <ThemeTag label={v} onRemove={remove} />}
                />
              </div>
            </div>

            <label className="field">
              <span className="field-label">Vidéo YouTube</span>
              <input className="input" placeholder="https://youtu.be/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
