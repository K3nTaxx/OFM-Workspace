import { PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** Zone de dépôt de fichiers (glisser-déposer + clic pour parcourir). */
export function DropZone({
  accept,
  multiple,
  onFiles,
  children,
}: {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      className="dropzone"
      data-over={over}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
    >
      {children}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) onFiles(files)
          e.target.value = ""
        }}
      />
    </div>
  )
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose selectable">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

/** Bloc de texte modifiable sur place : survol → crayon, clic → éditeur, Échap annule, Ctrl+Entrée valide. */
export function EditableBlock({
  value,
  onSave,
  render,
  placeholder,
  rows = 6,
}: {
  value: string
  onSave: (v: string) => void
  render: (v: string) => ReactNode
  placeholder?: string
  rows?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      requestAnimationFrame(() => ref.current?.focus())
    }
  }, [editing, value])

  if (editing) {
    const commit = () => {
      setEditing(false)
      if (draft !== value) onSave(draft)
    }
    return (
      <div className="editable editable--on">
        <textarea
          ref={ref}
          className="textarea"
          rows={rows}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false)
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit()
          }}
        />
        <div className="editable-actions">
          <span className="editable-hint">Markdown accepté · Ctrl+Entrée pour valider</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>
            Annuler
          </button>
          <button type="button" className="btn btn--sm btn--primary" onClick={commit}>
            Enregistrer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="editable" onDoubleClick={() => setEditing(true)}>
      {value ? render(value) : <p className="editable-empty">{placeholder}</p>}
      <button type="button" className="editable-pen btn btn--ghost btn--icon btn--sm" onClick={() => setEditing(true)} aria-label="Modifier">
        <PencilSimpleIcon size={13} />
      </button>
    </div>
  )
}

/** Champ texte sur une ligne, modifiable en place (titres). */
export function InlineText({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={`inline-text ${className ?? ""}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

/** Liste d'étiquettes avec ajout rapide (suggestions + saisie libre). */
export function TokenField({
  values,
  onChange,
  suggestions,
  renderToken,
  placeholder = "Ajouter…",
}: {
  values: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  renderToken: (v: string, remove: () => void) => ReactNode
  placeholder?: string
}) {
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState("")
  const rest = suggestions.filter((s) => !values.includes(s) && s.toLowerCase().includes(q.toLowerCase()))
  const add = (v: string) => {
    const t = v.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setQ("")
  }
  return (
    <div className="tokens">
      {values.map((v) => (
        <span key={v}>{renderToken(v, () => onChange(values.filter((x) => x !== v)))}</span>
      ))}
      {adding ? (
        <span className="token-add">
          <input
            autoFocus
            className="token-input"
            value={q}
            placeholder={placeholder}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => window.setTimeout(() => setAdding(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add(rest[0] && q ? rest[0] : q)
              }
              if (e.key === "Escape") setAdding(false)
              if (e.key === "Backspace" && !q && values.length) onChange(values.slice(0, -1))
            }}
          />
          {rest.length > 0 && (
            <span className="token-suggest">
              {rest.slice(0, 8).map((s) => (
                <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>
                  {s}
                </button>
              ))}
            </span>
          )}
        </span>
      ) : (
        <button type="button" className="token-plus" onClick={() => setAdding(true)} aria-label="Ajouter">
          <PlusIcon size={11} weight="bold" />
        </button>
      )}
    </div>
  )
}
