import { ClipboardTextIcon, FileTextIcon, UploadSimpleIcon, WaveformIcon, XIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Segmented, Switch, Tag } from "../components/Controls"
import { DropZone, TokenField } from "../components/Inputs"
import { Sheet } from "../components/Overlays"
import { CALL_TYPES, PEOPLE, THUMB_HUES } from "../data/catalog"
import type { CallType } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { fileSize, modKey } from "../lib/format"
import { useUI } from "../ui/UIProvider"
import { CallThumbnail } from "../components/CallThumbnail"

type Source = "fichier" | "texte" | "wispr"

export function NewCallSheet() {
  const { newCall, closeNewCall, toast } = useUI()
  const { calls, store, refresh } = useWorkspace()
  const navigate = useNavigate()

  const [source, setSource] = useState<Source>("fichier")
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [type, setType] = useState<CallType>("mentorat")
  const [participants, setParticipants] = useState<string[]>(["Jules"])
  const [videoUrl, setVideoUrl] = useState("")
  const [ai, setAi] = useState(true)
  const [busy, setBusy] = useState(false)

  const nextNumber = useMemo(() => Math.max(0, ...calls.map((c) => c.number)) + 1, [calls])
  const hue = THUMB_HUES[(nextNumber - 1) % THUMB_HUES.length]

  useEffect(() => {
    if (!newCall) return
    setSource("fichier")
    setFile(null)
    setPasted("")
    setTitle("")
    setDate(newCall.date ?? format(new Date(), "yyyy-MM-dd"))
    setTime("")
    setType("mentorat")
    setParticipants(["Jules"])
    setVideoUrl("")
    setAi(true)
    setBusy(false)
  }, [newCall])

  // Raccourci global « N » pour ouvrir la feuille (hors champs de saisie)
  const { openNewCall } = useUI()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable]")) return
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openNewCall()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openNewCall])

  const transcriptText = source === "texte" ? pasted.trim() : ""
  const hasTranscript = (source === "fichier" && !!file) || transcriptText.length > 0
  const isFuture = date > format(new Date(), "yyyy-MM-dd")

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const willAnalyze = hasTranscript && ai
      const call = await store.createCall({
        title: title.trim(),
        date,
        time: time || null,
        type,
        participants,
        videoUrl: videoUrl.trim() || null,
        hue,
        status: willAnalyze ? "analyzing" : !hasTranscript && isFuture ? "planned" : "ready",
      })
      if (hasTranscript) {
        const blob = file ?? new Blob([transcriptText], { type: "text/plain;charset=utf-8" })
        const name = file?.name ?? `Appel-${String(call.number).padStart(2, "0")}-transcription.txt`
        const transcript = await store.uploadTranscript(call.id, blob, name)
        await store.updateCall(call.id, { transcript })
      }
      await refresh()
      closeNewCall()
      navigate(`/appels/${call.id}`)
      toast(willAnalyze ? `Appel #${call.number} créé · analyse IA lancée` : `Appel #${call.number} créé`)
      if (willAnalyze) store.analyzeCall(call.id).then(refresh)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impossible de créer l'appel", "error")
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={!!newCall}
      onClose={closeNewCall}
      title="Nouvel appel"
      width={700}
      footer={
        <>
          <label className="ai-toggle" data-disabled={!hasTranscript}>
            <Switch on={ai && hasTranscript} onChange={setAi} />
            <span>
              <WaveformIcon size={14} /> Résumer avec l'IA
            </span>
          </label>
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeNewCall}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !date} onClick={submit}>
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
        <div className="newcall-preview">
          <CallThumbnail call={{ id: "preview", number: nextNumber, title: title || "Nouvel appel", hue, status: isFuture && !hasTranscript ? "planned" : "ready" }} />
        </div>

        <div className="newcall-form">
          <div className="field">
            <span className="field-label">Transcription</span>
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: "fichier", label: "Fichier", icon: <FileTextIcon size={14} /> },
                { value: "texte", label: "Coller", icon: <ClipboardTextIcon size={14} /> },
                { value: "wispr", label: "Wispr Flow", icon: <WaveformIcon size={14} /> },
              ]}
            />
          </div>

          {source === "fichier" &&
            (file ? (
              <div className="file-chip">
                <span className="file-row-icon">
                  <FileTextIcon size={16} />
                </span>
                <span style={{ flex: 1 }}>
                  <span className="file-chip-name">{file.name}</span>
                  <br />
                  <span className="file-chip-meta tnum">{fileSize(file.size)}</span>
                </span>
                <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setFile(null)} aria-label="Retirer">
                  <XIcon size={12} />
                </button>
              </div>
            ) : (
              <DropZone accept=".txt,.md,.vtt,.srt,text/plain" onFiles={([f]) => setFile(f)}>
                <span className="dropzone-icon">
                  <UploadSimpleIcon size={18} />
                </span>
                <strong>Glisse la transcription ici</strong>
                <small>.txt, .md, .vtt ou .srt — facultatif pour un appel à venir</small>
              </DropZone>
            ))}

          {source === "texte" && (
            <textarea
              className="textarea"
              rows={7}
              autoFocus
              placeholder="Colle ici la transcription complète de l'appel…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          )}

          {source === "wispr" && (
            <div className="wispr">
              <p>
                Wispr Flow ne propose pas encore de connexion directe pour les sites. Le plus rapide :
              </p>
              <ol>
                <li>
                  Dans Wispr Flow, ouvre l'appel → <b>Transcript</b> → copie tout.
                </li>
                <li>
                  Reviens ici, onglet <b>Coller</b>, et colle.
                </li>
              </ol>
              <p className="muted">Tu peux aussi demander à Claude : « le dernier appel s'appelle … » — il l'importe pour toi.</p>
            </div>
          )}

          <div className="form-row">
            <label className="field" style={{ flex: 2 }}>
              <span className="field-label">Titre</span>
              <input className="input" placeholder={hasTranscript && ai ? "Laisse vide : l'IA proposera un titre" : `Appel #${nextNumber}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input className="input tnum" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field" style={{ maxWidth: 110 }}>
              <span className="field-label">Heure</span>
              <input className="input tnum" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
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
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Vidéo YouTube</span>
              <input className="input" placeholder="https://youtu.be/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
