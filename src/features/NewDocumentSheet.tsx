import { FilePdfIcon, LinkSimpleIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Segmented } from "../components/Controls"
import { FileGlyph, kindFromFile } from "../components/FileGlyph"
import { DropZone } from "../components/Inputs"
import { Sheet } from "../components/Overlays"
import { DOC_SOURCES } from "../data/catalog"
import { useWorkspace } from "../data/workspace"
import { fileSize } from "../lib/format"
import { useUI } from "../ui/UIProvider"

interface Pending {
  file: File
  title: string
}

export function NewDocumentSheet() {
  const { newDoc, closeNewDoc, toast } = useUI()
  const { categories, calls, store, refresh } = useWorkspace()
  const [mode, setMode] = useState<"fichiers" | "lien">("fichiers")
  const [pending, setPending] = useState<Pending[]>([])
  const [link, setLink] = useState({ url: "", title: "" })
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [source, setSource] = useState("Jules")
  const [callId, setCallId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!newDoc) return
    setMode("fichiers")
    setPending((newDoc.files ?? []).map((file) => ({ file, title: file.name.replace(/\.[^.]+$/, "") })))
    setLink({ url: "", title: "" })
    setCategoryId(newDoc.categoryId ?? categories[0]?.id ?? null)
    setCallId(newDoc.callId ?? null)
    setBusy(false)
  }, [newDoc])

  const canSubmit = mode === "fichiers" ? pending.length > 0 : /^https?:\/\//.test(link.url.trim())

  const submit = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      if (mode === "fichiers") {
        for (const p of pending) {
          await store.createDocument(
            { title: p.title.trim() || p.file.name, fileName: p.file.name, kind: kindFromFile(p.file), categoryId, source, callId },
            p.file,
          )
        }
        toast(pending.length > 1 ? `${pending.length} documents ajoutés` : "Document ajouté")
      } else {
        const url = link.url.trim()
        await store.createDocument({
          title: link.title.trim() || url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
          kind: "link",
          url,
          categoryId,
          source,
          callId,
        })
        toast("Lien ajouté")
      }
      await refresh()
      closeNewDoc()
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'ajout", "error")
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={!!newDoc}
      onClose={closeNewDoc}
      title="Ajouter à la bibliothèque"
      width={600}
      footer={
        <>
          <span className="sheet-foot-hint">{mode === "fichiers" && pending.length > 0 && `${pending.length} fichier${pending.length > 1 ? "s" : ""}`}</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeNewDoc}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? <span className="spinner" /> : null}
            Ajouter
          </button>
        </>
      }
    >
      <div className="form">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "fichiers", label: "Fichiers", icon: <FilePdfIcon size={14} /> },
            { value: "lien", label: "Lien", icon: <LinkSimpleIcon size={14} /> },
          ]}
        />

        {mode === "fichiers" ? (
          <>
            <DropZone multiple onFiles={(files) => setPending((p) => [...p, ...files.map((file) => ({ file, title: file.name.replace(/\.[^.]+$/, "") }))])}>
              <span className="dropzone-icon">
                <UploadSimpleIcon size={18} />
              </span>
              <strong>Glisse tes PDF ici</strong>
              <small>ou clique pour les choisir · plusieurs fichiers à la fois</small>
            </DropZone>
            {pending.length > 0 && (
              <div className="pending-list">
                {pending.map((p, i) => (
                  <div key={i} className="file-chip">
                    <FileGlyph doc={{ kind: kindFromFile(p.file) }} small />
                    <input
                      className="inline-text"
                      value={p.title}
                      onChange={(e) => setPending((all) => all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <span className="file-chip-meta tnum">{fileSize(p.file.size)}</span>
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setPending((all) => all.filter((_, j) => j !== i))} aria-label="Retirer">
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="form-row">
            <label className="field" style={{ flex: 2 }}>
              <span className="field-label">Adresse</span>
              <input className="input" autoFocus placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Nom</span>
              <input className="input" placeholder="Facultatif" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
            </label>
          </div>
        )}

        <div className="field">
          <span className="field-label">Catégorie</span>
          <div className="choice-row">
            {categories.map((c) => (
              <button key={c.id} type="button" className="choice" data-active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                <span className="dot" data-color={c.color} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Source</span>
            <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
              {DOC_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Lié à l'appel</span>
            <select className="select" value={callId ?? ""} onChange={(e) => setCallId(e.target.value || null)}>
              <option value="">Aucun</option>
              {calls.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.number} — {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Sheet>
  )
}
