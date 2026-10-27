import { ClipboardTextIcon, PlusIcon } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
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

/** Une ligne de texte avec le gras, l'italique et les liens Markdown (listes du résumé). */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={["strong", "em", "code", "a", "del"]} unwrapDisallowed>
      {children}
    </ReactMarkdown>
  )
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose selectable">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

/**
 * Texte modifiable en place (titres, actions). `multiline` : le texte va à la ligne au lieu d'être coupé (titres
 * longs, téléphone) ; Entrée valide quand même, il n'y a pas de retour à la ligne dans la valeur.
 */
export function InlineText({
  value,
  onSave,
  className,
  placeholder,
  multiline,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setDraft(value), [value])

  // Hauteur ajustée au texte (une ligne, deux, trois…) et recalculée quand la largeur change
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const fit = () => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [draft])

  const props = {
    className: `inline-text ${multiline ? "inline-text--multi" : ""} ${className ?? ""}`,
    value: draft,
    placeholder,
    onBlur: () => {
      // Échap : on quitte le champ sans rien enregistrer
      if (cancelled.current) {
        cancelled.current = false
        setDraft(value)
        return
      }
      if (draft.trim() !== value) onSave(draft.trim())
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        e.currentTarget.blur()
      }
      if (e.key === "Escape") {
        e.preventDefault()
        cancelled.current = true
        e.currentTarget.blur()
      }
    },
  }
  return multiline ? (
    <textarea ref={area} rows={1} {...props} onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))} />
  ) : (
    <input {...props} onChange={(e) => setDraft(e.target.value)} />
  )
}

/**
 * Champ de l'inspecteur (date, heure, durée) : on tape librement, l'enregistrement part une seule fois en quittant
 * le champ ou avec Entrée ; Échap annule. `parse` renvoie undefined pour une saisie incomplète (rien n'est enregistré).
 */
export function DraftInput<T>({
  value,
  format,
  parse,
  onSave,
  ...props
}: {
  value: T
  format: (v: T) => string
  parse: (s: string) => T | undefined
  onSave: (v: T) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur">) {
  const [draft, setDraft] = useState(format(value))
  const cancelled = useRef(false)
  useEffect(() => setDraft(format(value)), [value, format])
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = cancelled.current ? undefined : parse(draft)
        cancelled.current = false
        if (next === undefined || format(next) === format(value)) setDraft(format(value))
        else onSave(next)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          e.preventDefault()
          cancelled.current = true
          e.currentTarget.blur()
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
              if (e.key === "Escape") {
                e.preventDefault()
                setAdding(false)
              }
              if (e.key === "Backspace" && !q && values.length) onChange(values.slice(0, -1))
            }}
          />
          {rest.length > 0 && (
            <span
              className="token-suggest"
              ref={(el) => {
                if (!el) return
                const box = el.parentElement!.getBoundingClientRect()
                el.dataset.up = String(box.bottom + 230 > window.innerHeight && box.top > 240)
              }}
            >
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

/** Zone où l'on colle un long texte (résumé, transcription) : bouton « Coller », ou glisser un fichier texte dessus. */
export function PasteBox({
  label,
  icon,
  value,
  onChange,
  placeholder,
  status,
  rows = 9,
  autoFocus,
  selectOnFocus,
}: {
  label: string
  icon: ReactNode
  value: string
  onChange: (v: string) => void
  placeholder: string
  status?: ReactNode
  rows?: number
  autoFocus?: boolean
  selectOnFocus?: boolean
}) {
  const [over, setOver] = useState(false)
  const [denied, setDenied] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const selected = useRef(false)
  const filled = value.trim().length > 0

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) onChange(text)
      else area.current?.focus()
    } catch {
      // Lecture du presse-papiers refusée : Ctrl+V dans la zone fait la même chose
      setDenied(true)
      area.current?.focus()
    }
  }

  return (
    <div
      className="pastebox"
      data-filled={filled}
      data-over={over}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        const file = e.dataTransfer.files[0]
        if (!file) return
        e.preventDefault()
        setOver(false)
        // Un PDF ou un Word lu comme du texte donnerait des caractères illisibles
        if (file.type.startsWith("text/") || /\.(txt|md|markdown|srt|vtt)$/i.test(file.name)) onChange(await file.text())
        else setRejected(file.name)
      }}
    >
      <div className="pastebox-head">
        <span className="pastebox-icon">{icon}</span>
        <span className="pastebox-label">{label}</span>
        <span className="pastebox-spacer" />
        {filled ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange("")}>
            Effacer
          </button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={paste}>
            <ClipboardTextIcon size={13} /> Coller
          </button>
        )}
      </div>
      <textarea
        ref={area}
        className="pastebox-area selectable"
        rows={rows}
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={denied ? "Clique ici puis Ctrl+V" : placeholder}
        value={value}
        onFocus={(e) => {
          // Texte déjà présent : tout est sélectionné à l'ouverture, un Ctrl+V le remplace
          if (selectOnFocus && !selected.current) e.currentTarget.select()
          selected.current = true
        }}
        onChange={(e) => {
          setRejected(null)
          onChange(e.target.value)
        }}
      />
      {rejected && !filled && <div className="pastebox-status" data-tone="error">« {rejected} » n'est pas un fichier texte (.txt ou .md)</div>}
      {filled && status && <div className="pastebox-status">{status}</div>}
    </div>
  )
}
