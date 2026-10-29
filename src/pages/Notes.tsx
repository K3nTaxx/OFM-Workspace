import {
  CaretLeftIcon,
  CheckSquareIcon,
  CopyIcon,
  ListBulletsIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PushPinIcon,
  PushPinSlashIcon,
  TextHIcon,
  TextStrikethroughIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from "react"
import { useSearchParams } from "react-router-dom"
import { Toolbar } from "../components/Chrome"
import { Checkbox } from "../components/Controls"
import type { Note, NoteBlock, NoteInput } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { fmt, relativeDay } from "../lib/format"
import { emptyBlock, noteToMarkdown, notePreview } from "../lib/noteMarkdown"
import { useRemembered } from "../ui/remember"
import { useUI } from "../ui/UIProvider"
import { useIsMobile } from "../ui/useIsMobile"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

const noteName = (n: Note) => n.title.trim() || n.blocks.find((b) => b.text.trim())?.text.trim() || "Nouvelle note"

/** « 14:32 » aujourd'hui, « Hier », sinon la date courte. */
const when = (iso: string) => {
  const day = iso.slice(0, 10)
  const label = relativeDay(day)
  return label === "Aujourd'hui" ? fmt(iso, "HH:mm") : label
}

/** Zone de texte dont la hauteur suit le contenu (une ligne, deux, trois…). */
function AutoTextarea({ value, elRef, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; elRef?: (el: HTMLTextAreaElement | null) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <textarea
      {...props}
      ref={(el) => {
        ref.current = el
        elRef?.(el)
      }}
      rows={1}
      value={value}
      spellCheck
    />
  )
}

/**
 * Éditeur d'une note, comme Notes sur Mac et iPhone : une ligne = un paragraphe, une case à cocher, une puce ou un
 * intertitre. Entrée crée la ligne suivante du même genre ; « - », « [] » ou « # » en début de ligne changent son
 * genre ; Retour arrière au début d'une ligne la fusionne avec la précédente. Enregistrement automatique.
 */
function NoteEditor({ note, onSave, focusTitle }: { note: Note; onSave: (patch: NoteInput) => void; focusTitle: boolean }) {
  const initial = () => (note.blocks.length ? note.blocks : [emptyBlock()])
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState<NoteBlock[]>(initial)
  const [active, setActive] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const titleRef = useRef<HTMLTextAreaElement | null>(null)
  const focusNext = useRef<{ id: string; at: number | "end" } | null>(null)
  const pending = useRef<{ title: string; blocks: NoteBlock[] } | null>(null)
  const timer = useRef(0)
  const save = useRef(onSave)
  save.current = onSave

  // Enregistrement 0,4 s après la dernière modification (et tout de suite en quittant la note)
  const commit = (nextTitle: string, nextBlocks: NoteBlock[]) => {
    pending.current = { title: nextTitle, blocks: nextBlocks }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (pending.current) save.current(pending.current)
      pending.current = null
    }, 400)
  }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (pending.current) save.current(pending.current)
    },
    [],
  )

  // Modifiée ailleurs (autre appareil, conversation Claude) : reprise si on n'est pas en train d'écrire dedans
  useEffect(() => {
    if (pending.current || document.activeElement?.closest(".note-editor")) return
    setTitle(note.title)
    setBlocks(initial())
  }, [note.updatedAt])

  useEffect(() => {
    if (focusTitle) titleRef.current?.focus()
  }, [focusTitle])

  useLayoutEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    const el = refs.current.get(target.id)
    if (!el) return
    el.focus()
    const at = target.at === "end" ? el.value.length : target.at
    el.setSelectionRange(at, at)
  })

  const change = (next: NoteBlock[]) => {
    setBlocks(next)
    commit(title, next)
  }
  const patch = (id: string, p: Partial<NoteBlock>) => change(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)))

  const onText = (b: NoteBlock, value: string) => {
    // Raccourcis en début de ligne : « - » puce, « [] » case à cocher, « # » intertitre
    if (b.type === "text") {
      const m = value.match(/^(\[\s?\]|-|\*|#)\s/)
      if (m) {
        const type = m[1].startsWith("[") ? "check" : m[1] === "#" ? "heading" : "bullet"
        focusNext.current = { id: b.id, at: 0 }
        return patch(b.id, { type, text: value.slice(m[0].length) })
      }
    }
    patch(b.id, { text: value })
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, b: NoteBlock, i: number) => {
    const el = e.currentTarget
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Entrée sur une case ou une puce vide : on sort de la liste
      if (!b.text && (b.type === "check" || b.type === "bullet")) return patch(b.id, { type: "text", done: false })
      const created = { ...emptyBlock(b.type === "heading" ? "text" : b.type), text: el.value.slice(el.selectionEnd) }
      const next = [...blocks]
      next.splice(i, 1, { ...b, text: el.value.slice(0, el.selectionStart) }, created)
      focusNext.current = { id: created.id, at: 0 }
      return change(next)
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.type !== "text") {
        e.preventDefault()
        return patch(b.id, { type: "text", done: false })
      }
      if (i > 0) {
        e.preventDefault()
        const prev = blocks[i - 1]
        focusNext.current = { id: prev.id, at: prev.text.length }
        return change(blocks.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: x.text + b.text } : x)))
      }
    }
    if (e.key === "ArrowUp" && el.selectionStart === 0 && i > 0) {
      e.preventDefault()
      focusNext.current = { id: blocks[i - 1].id, at: "end" }
      setActive(blocks[i - 1].id)
    }
    if (e.key === "ArrowDown" && el.selectionEnd === el.value.length && i < blocks.length - 1) {
      e.preventDefault()
      focusNext.current = { id: blocks[i + 1].id, at: 0 }
      setActive(blocks[i + 1].id)
    }
  }

  const remove = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id)
    const next = blocks.filter((b) => b.id !== id)
    if (!next.length) next.push(emptyBlock())
    const neighbour = next[Math.max(0, i - 1)]
    focusNext.current = { id: neighbour.id, at: "end" }
    change(next)
  }

  // Barre de mise en forme : agit sur la ligne où l'on écrit (ou la dernière touchée)
  const target = blocks.find((b) => b.id === active) ?? blocks[blocks.length - 1]
  const setType = (type: NoteBlock["type"]) => {
    focusNext.current = { id: target.id, at: "end" }
    patch(target.id, { type: target.type === type ? "text" : type, done: false })
  }
  const keep = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="note-editor">
      <div className="note-format" role="toolbar" aria-label="Mise en forme">
        <button type="button" data-on={target.type === "heading"} onMouseDown={keep} onClick={() => setType("heading")} aria-label="Intertitre">
          <TextHIcon size={18} />
        </button>
        <button type="button" data-on={target.type === "bullet"} onMouseDown={keep} onClick={() => setType("bullet")} aria-label="Liste à puces">
          <ListBulletsIcon size={18} />
        </button>
        <button type="button" data-on={target.type === "check"} onMouseDown={keep} onClick={() => setType("check")} aria-label="Case à cocher">
          <CheckSquareIcon size={18} />
        </button>
        <button
          type="button"
          data-on={!!target.struck}
          onMouseDown={keep}
          onClick={() => {
            focusNext.current = { id: target.id, at: "end" }
            patch(target.id, { struck: !target.struck })
          }}
          aria-label="Barrer la ligne"
        >
          <TextStrikethroughIcon size={18} />
        </button>
        <span className="note-format-sep" />
        <button type="button" onMouseDown={keep} onClick={() => remove(target.id)} aria-label="Supprimer la ligne">
          <XIcon size={17} />
        </button>
      </div>

      <div
        className="note-page selectable"
        onClick={(e) => {
          // Un clic sous la dernière ligne continue la note
          if (e.target !== e.currentTarget) return
          const last = blocks[blocks.length - 1]
          if (last.text) {
            const created = emptyBlock()
            focusNext.current = { id: created.id, at: 0 }
            change([...blocks, created])
          } else {
            focusNext.current = { id: last.id, at: 0 }
            setActive(last.id)
            setBlocks([...blocks])
          }
        }}
      >
        <AutoTextarea
          elRef={(el) => (titleRef.current = el)}
          className="note-title"
          value={title}
          placeholder="Titre"
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, " ")
            setTitle(v)
            commit(v, blocks)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "ArrowDown" && e.currentTarget.selectionEnd === e.currentTarget.value.length)) {
              e.preventDefault()
              focusNext.current = { id: blocks[0].id, at: 0 }
              setActive(blocks[0].id)
              setBlocks([...blocks])
            }
          }}
        />
        <div className="note-meta">Modifiée {when(note.updatedAt).toLowerCase() === "hier" ? "hier" : `le ${fmt(note.updatedAt, "d MMMM à HH:mm")}`}</div>

        {blocks.map((b, i) => (
          <div key={b.id} className="note-line" data-type={b.type} data-done={!!b.done} data-struck={!!b.struck} data-active={b.id === active}>
            {b.type === "check" && <Checkbox label={b.text} checked={!!b.done} onChange={(v) => patch(b.id, { done: v })} />}
            {b.type === "bullet" && <span className="note-bullet" aria-hidden />}
            <AutoTextarea
              elRef={(el) => {
                if (el) refs.current.set(b.id, el)
                else refs.current.delete(b.id)
              }}
              className="note-text"
              value={b.text}
              placeholder={blocks.length === 1 && !b.text ? "Écris ici…  « - » liste · « [] » case à cocher · « # » intertitre" : ""}
              onFocus={() => setActive(b.id)}
              onChange={(e) => onText(b, e.target.value)}
              onKeyDown={(e) => onKey(e, b, i)}
            />
            <button type="button" className="note-line-del" onMouseDown={keep} onClick={() => remove(b.id)} aria-label="Supprimer la ligne">
              <XIcon size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Notes personnelles : la liste à gauche (épinglées en haut), la note ouverte à droite. Sur téléphone, l'une puis l'autre. */
export function Notes() {
  const { notes, store, refresh, patchNote } = useWorkspace()
  const { openMenu, toast, confirm } = useUI()
  const [params, setParams] = useSearchParams()
  const mobile = useIsMobile()
  const [q, setQ] = useRemembered("notes.recherche", "")
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const nq = norm(q.trim())
    return [...notes]
      .filter((n) => !nq || norm(`${n.title} ${n.blocks.map((b) => b.text).join(" ")}`).includes(nq))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, q])

  const id = params.get("note")
  const current = notes.find((n) => n.id === id) ?? (mobile ? null : (sorted[0] ?? null))
  const open = (noteId: string | null) => setParams(noteId ? { note: noteId } : {}, { replace: !mobile })

  const create = async () => {
    const n = await store.createNote({ title: "", blocks: [emptyBlock()] })
    await refresh()
    setJustCreated(n.id)
    setParams({ note: n.id })
  }

  const remove = async (n: Note) => {
    const ok = await confirm({ title: `Supprimer « ${noteName(n)} » ?`, message: "La note sera définitivement effacée.", confirmLabel: "Supprimer", danger: true })
    if (!ok) return
    await store.deleteNote(n.id)
    await refresh()
    if (current?.id === n.id) open(null)
    toast("Note supprimée")
  }

  const copy = (n: Note) => {
    navigator.clipboard.writeText(noteToMarkdown(n.title, n.blocks))
    toast("Note copiée")
  }

  const menuFor = (n: Note) => [
    {
      label: n.pinned ? "Désépingler" : "Épingler en haut",
      icon: n.pinned ? <PushPinSlashIcon size={15} /> : <PushPinIcon size={15} />,
      onSelect: () => patchNote(n.id, { pinned: !n.pinned }),
    },
    { label: "Copier le texte", icon: <CopyIcon size={15} />, onSelect: () => copy(n) },
    { separator: true },
    { label: "Supprimer…", icon: <TrashIcon size={15} />, danger: true, onSelect: () => remove(n) },
  ]

  const pinned = sorted.filter((n) => n.pinned)
  const others = sorted.filter((n) => !n.pinned)
  const editing = mobile && !!current

  const list = (
    <div className="page-scroll notes-list">
      <label className="search notes-search">
        <MagnifyingGlassIcon size={14} />
        <input className="input" placeholder="Rechercher dans mes notes" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <p className="notes-private">
        <LockSimpleIcon size={12} /> Visibles par toi seul
      </p>
      {sorted.length === 0 ? (
        <div className="empty" style={{ paddingTop: 60 }}>
          <NotePencilIcon className="empty-icon" size={40} weight="thin" />
          <strong>{q ? "Aucune note trouvée" : "Aucune note"}</strong>
          {!q && (
            <button type="button" className="btn btn--primary" onClick={create}>
              <NotePencilIcon size={15} /> Nouvelle note
            </button>
          )}
        </div>
      ) : (
        [
          ["Épinglées", pinned],
          [pinned.length ? "Notes" : "", others],
        ].map(([label, group]) =>
          (group as Note[]).length ? (
            <section key={label as string} className="notes-group">
              {label && <h3 className="notes-group-title">{label as string}</h3>}
              <div className="notes-group-items">
                {(group as Note[]).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="note-item"
                    data-active={!mobile && current?.id === n.id}
                    onClick={() => open(n.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      openMenu(e, menuFor(n))
                    }}
                  >
                    <span className="note-item-title">
                      {n.pinned && <PushPinIcon size={12} weight="fill" className="note-item-pin" />}
                      {noteName(n)}
                    </span>
                    <span className="note-item-meta">
                      <time className="tnum">{when(n.updatedAt)}</time>
                      <span>{notePreview(n.blocks) || "Pas de texte"}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null,
        )
      )}
    </div>
  )

  return (
    <>
      <Toolbar>
        {editing && (
          <button type="button" className="btn btn--ghost btn--icon toolbar-back" onClick={() => open(null)} aria-label="Toutes les notes">
            <CaretLeftIcon size={20} />
          </button>
        )}
        <div className="toolbar-title">
          {editing ? "" : "Notes"}
          {!editing && <small className="tnum">{notes.length}</small>}
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group">
          {current && (!mobile || editing) && (
            <>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => patchNote(current.id, { pinned: !current.pinned })} aria-label={current.pinned ? "Désépingler" : "Épingler"}>
                {current.pinned ? <PushPinSlashIcon size={16} /> : <PushPinIcon size={16} />}
              </button>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => copy(current)} aria-label="Copier le texte">
                <CopyIcon size={16} />
              </button>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => remove(current)} aria-label="Supprimer la note">
                <TrashIcon size={16} />
              </button>
            </>
          )}
          <button type="button" className="btn btn--primary" onClick={create}>
            <NotePencilIcon size={15} />
            Nouvelle note
          </button>
        </div>
      </Toolbar>

      <div className="notes" data-editing={editing}>
        {(!mobile || !editing) && list}
        {current ? (
          <div className="page-scroll notes-main">
            <NoteEditor key={current.id} note={current} focusTitle={justCreated === current.id} onSave={(p) => patchNote(current.id, p)} />
          </div>
        ) : (
          !mobile && (
            <div className="notes-main notes-main--empty">
              <div className="empty">
                <NotePencilIcon className="empty-icon" size={44} weight="thin" />
                <strong>Tes notes</strong>
                Du texte libre, des cases à cocher, des listes : tout ce que tu veux retenir.
              </div>
            </div>
          )
        )}
      </div>
    </>
  )
}
