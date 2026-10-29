// Une note ↔ du Markdown simple : sert à « Copier » une note, et à la commande `npm run note` (notes reformulées par
// Claude). Extension « .ts » explicite : ce fichier est aussi lu directement par Node (scripts/note.mjs).
import type { NoteBlock } from "../data/types"

const newId = () => crypto.randomUUID()

export const emptyBlock = (type: NoteBlock["type"] = "text"): NoteBlock => ({ id: newId(), type, text: "" })

/**
 * `# Titre` → titre · `## …` → intertitre · `- [ ] …` / `- [x] …` → case à cocher · `- …` → puce ·
 * `~~…~~` sur toute la ligne → ligne barrée · le reste → une ligne de texte par ligne.
 */
export function markdownToNote(md: string): { title: string; blocks: NoteBlock[] } {
  let title = ""
  const blocks: NoteBlock[] = []
  const text = md.replace(/\r\n/g, "\n").replace(/^\s*```(?:markdown|md)?\s*\n/, "").replace(/\n```\s*$/, "")
  for (const raw of text.split("\n")) {
    let line = raw.trim()
    if (!line) continue
    const h1 = line.match(/^#\s+(.+)$/)
    if (h1 && !title && !blocks.length) {
      title = h1[1].trim()
      continue
    }
    let struck = false
    const strike = line.match(/^(?:([-*•]\s+(?:\[[ xX]\]\s+)?))?~~(.+)~~$/)
    if (strike) {
      struck = true
      line = (strike[1] ?? "") + strike[2]
    }
    const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").trim()
    let block: NoteBlock
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    const check = line.match(/^[-*•]\s+\[( |x|X)\]\s*(.*)$/)
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (heading) block = { id: newId(), type: "heading", text: clean(heading[1]) }
    else if (check) block = { id: newId(), type: "check", text: clean(check[2]), done: check[1].toLowerCase() === "x" }
    else if (bullet) block = { id: newId(), type: "bullet", text: clean(bullet[1]) }
    else block = { id: newId(), type: "text", text: clean(line) }
    if (struck) block.struck = true
    blocks.push(block)
  }
  return { title, blocks: blocks.length ? blocks : [emptyBlock()] }
}

export function noteToMarkdown(title: string, blocks: NoteBlock[]): string {
  const lines = title.trim() ? [`# ${title.trim()}`, ""] : []
  for (const b of blocks) {
    if (!b.text.trim() && b.type !== "check") continue
    const t = b.struck ? `~~${b.text}~~` : b.text
    if (b.type === "heading") lines.push("", `## ${t}`)
    else if (b.type === "check") lines.push(`- [${b.done ? "x" : " "}] ${t}`)
    else if (b.type === "bullet") lines.push(`- ${t}`)
    else lines.push(t)
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

/** Aperçu d'une note dans la liste : première ligne de texte, ou l'avancement des cases à cocher. */
export function notePreview(blocks: NoteBlock[]): string {
  const checks = blocks.filter((b) => b.type === "check" && b.text.trim())
  const first = blocks.find((b) => b.text.trim() && b.type !== "heading")?.text.trim() ?? ""
  if (checks.length && (!first || blocks[0]?.type === "check")) return `${checks.filter((b) => b.done).length} sur ${checks.length} cochées`
  return first
}
