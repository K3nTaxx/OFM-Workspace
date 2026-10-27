// Lit un résumé collé (Markdown, format du skill « resume-appel-ofm », ou simple texte) : le titre « # … » et le
// bloc « ## Infos » remplissent la fiche, les actions vont dans l'onglet Actions, et tout le reste est gardé tel quel.
// Extension « .ts » explicite : ce fichier est aussi lu directement par Node (scripts/setup.mjs).
import { CALL_TYPES, OWNERS, THEMES, callType } from "../data/catalog.ts"
import type { ActionItem, Call, CallSummary, CallType } from "../data/types"

export interface ParsedInfo {
  title?: string
  date?: string
  time?: string
  durationMin?: number
  type?: CallType
  participants?: string[]
  themes?: string[]
}

export interface ParsedSummary {
  summary: CallSummary
  actions: ActionItem[]
  info: ParsedInfo
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .trim()

/** Titre de section sans numéro ni emoji (« 1. 🌍 Marché FR » → « Marché FR »). */
const cleanHeading = (s: string) =>
  s
    .replace(/^[^\p{L}\d]*(\d+[.)]?\s*)?[^\p{L}\d«"]*/u, "")
    .replace(/\s+$/, "")

/** Les deux sections que le site traite à part : « Infos » (→ fiche) et « Actions » (→ onglet Actions). */
export function sectionKind(heading: string): "info" | "actions" | null {
  const h = fold(cleanHeading(heading))
  if (/^(infos?|informations|details)\b/.test(h)) return "info"
  if (/^(actions?|a faire|ce qu'on doit faire|prochaines etapes|taches)\b/.test(h)) return "actions"
  return null
}

export interface Section {
  heading: string | null // null : texte avant le premier « ## »
  body: string
}

/** Découpe un Markdown en sections « ## » (le texte avant le premier titre forme une section sans titre). */
export function splitSections(md: string): Section[] {
  const sections: Section[] = [{ heading: null, body: "" }]
  const bodies: string[][] = [[]]
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      sections.push({ heading: h2[1].trim(), body: "" })
      bodies.push([])
    } else bodies[bodies.length - 1].push(line)
  }
  sections.forEach((s, i) => (s.body = bodies[i].join("\n").trim()))
  return sections.filter((s) => s.heading !== null || s.body)
}

/** Éléments d'une liste Markdown (les lignes de continuation sont rattachées à l'élément précédent). */
function listItems(body: string): string[] {
  const items: string[] = []
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (m) items.push(m[1].trim())
    else if (items.length) items[items.length - 1] += ` ${line.trim()}`
    else items.push(line.trim())
  }
  return items
}

const OWNER_FOLD = OWNERS.map((o) => [fold(o), o] as const)

function parseAction(item: string): ActionItem {
  let done = false
  let text = item.replace(/^\[( |x|X)\]\s*/, (_, x: string) => {
    done = x.toLowerCase() === "x"
    return ""
  })
  let owner: string | undefined
  const dash = text.match(/^(.*\S)\s+[—–-]\s+([^—–-]+)$/)
  const paren = text.match(/^(.*\S)\s*\(([^()]+)\)$/)
  for (const m of [dash, paren]) {
    if (!m) continue
    const found = OWNER_FOLD.find(([f]) => f === fold(m[2]))
    if (found) {
      text = m[1]
      owner = found[1]
      break
    }
  }
  return { id: crypto.randomUUID(), text: text.trim(), owner, done }
}

const splitKV = (item: string) => {
  const i = item.search(/\s*:\s/)
  if (i < 0) return null
  return { key: item.slice(0, i).replace(/\*\*/g, "").trim(), value: item.slice(i).replace(/^\s*:\s*/, "").replace(/\*\*/g, "").trim() }
}

/** « AAAA-MM-JJ » seulement si ce jour existe (pas de 31 septembre). */
function realDay(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function parseDate(v: string): string | undefined {
  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return realDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const fr = v.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/)
  if (fr) {
    const y = Number(fr[3].length === 2 ? `20${fr[3]}` : fr[3])
    const [a, b] = [Number(fr[1]), Number(fr[2])]
    // Jour/mois à la française ; si le mois dépasse 12, c'était l'ordre américain (mois/jour)
    return realDay(y, b, a) ?? (b > 12 ? realDay(y, a, b) : undefined)
  }
  return undefined
}

function parseTime(v: string): string | undefined {
  const m = v.match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/)
  return m ? `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` : undefined
}

function parseDuration(v: string): number | undefined {
  const hm = v.match(/(\d+)\s*h\s*(\d+)?/i)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0)
  const min = v.match(/(\d+)/)
  return min ? Number(min[1]) : undefined
}

const list = (v: string) =>
  v
    .split(/[,;]| et /)
    .map((s) => s.trim())
    .filter(Boolean)

function parseInfo(body: string, info: ParsedInfo) {
  for (const item of listItems(body)) {
    const kv = splitKV(item)
    if (!kv) continue
    const k = fold(kv.key)
    if (k.startsWith("date")) info.date = parseDate(kv.value) ?? info.date
    else if (k.startsWith("heure")) info.time = parseTime(kv.value) ?? info.time
    else if (k.startsWith("duree")) info.durationMin = parseDuration(kv.value) ?? info.durationMin
    else if (k.startsWith("type")) {
      const t = CALL_TYPES.find((x) => fold(x.label) === fold(kv.value) || x.id === fold(kv.value))
      if (t) info.type = t.id
    } else if (k.startsWith("intervenant") || k.startsWith("participant")) info.participants = list(kv.value)
    else if (k.startsWith("theme")) {
      info.themes = list(kv.value).map((t) => THEMES.find((x) => fold(x.label) === fold(t))?.label ?? t)
    } else if (k.startsWith("titre")) info.title = kv.value
  }
}

const joinSections = (sections: Section[]) =>
  sections
    .map((s) => (s.heading === null ? s.body : `## ${s.heading}\n${s.body}`.trim()))
    .join("\n\n")
    .trim()

export function parseSummaryMarkdown(md: string): ParsedSummary {
  const actions: ActionItem[] = []
  const info: ParsedInfo = {}

  // On retire un éventuel bloc de code englobant (copie depuis une conversation)
  let text = md.replace(/\r\n/g, "\n").replace(/^\s*```(?:markdown|md)?\s*\n/, "").replace(/\n```\s*$/, "")
  const h1 = text.match(/^\s*#\s+(.+)$/m)
  if (h1 && !text.slice(0, h1.index).trim()) {
    info.title = h1[1].replace(/^appel\s*#?\s*\d+\s*[—–:-]\s*/i, "").trim()
    text = text.slice((h1.index ?? 0) + h1[0].length)
  }

  const kept = splitSections(text).flatMap((s): Section[] => {
    const kind = s.heading === null ? null : sectionKind(s.heading)
    if (kind === "actions") actions.push(...listItems(s.body).map(parseAction))
    if (kind !== "info") return [s]
    // « Infos » = la liste « clé : valeur » du début ; un texte écrit juste après reste dans le résumé
    const lines = s.body.split("\n")
    let i = 0
    while (i < lines.length && /^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i])) i++
    parseInfo(lines.slice(0, i).join("\n"), info)
    const rest = lines.slice(i).join("\n").trim()
    return rest ? [{ heading: null, body: rest }] : []
  })

  return { summary: { markdown: joinSections(kept) }, actions, info }
}

/** Petit compte rendu de ce qui a été reconnu, affiché pendant le collage. */
export function describeParsed(p: ParsedSummary) {
  const parts: string[] = []
  const n = splitSections(p.summary.markdown).filter((s) => s.heading !== null).length
  if (n) parts.push(`${n} partie${n > 1 ? "s" : ""}`)
  if (p.actions.length) parts.push(`${p.actions.length} action${p.actions.length > 1 ? "s" : ""}`)
  if (p.info.type) parts.push(`type ${callType(p.info.type).label}`)
  if (p.info.themes?.length) parts.push(`${p.info.themes.length} thème${p.info.themes.length > 1 ? "s" : ""}`)
  return parts
}

const actionLine = (a: ActionItem) => `- [${a.done ? "x" : " "}] ${a.text}${a.owner ? ` — ${a.owner}` : ""}`

/** Le résumé complet à copier ou à modifier : titre, infos, puis le texte collé (actions à jour). */
export function summaryToMarkdown(call: Call): string {
  const out: string[] = [`# Appel #${call.number} — ${call.title}`, ""]
  out.push("## Infos")
  const [y, m, d] = call.date.split("-")
  out.push(`- Date : ${d}/${m}/${y}`)
  if (call.time) out.push(`- Heure : ${call.time}`)
  if (call.durationMin) out.push(`- Durée : ${call.durationMin} min`)
  out.push(`- Type : ${callType(call.type).label}`)
  if (call.participants.length) out.push(`- Intervenants : ${call.participants.join(", ")}`)
  if (call.themes.length) out.push(`- Thèmes : ${call.themes.join(", ")}`)
  out.push("")

  const sections = splitSections(call.summary?.markdown ?? "")
  const actions = sections.find((s) => s.heading && sectionKind(s.heading) === "actions")
  if (actions) actions.body = call.actions.map(actionLine).join("\n")
  else if (call.actions.length) sections.push({ heading: "Actions", body: call.actions.map(actionLine).join("\n") })
  out.push(joinSections(sections))
  return out.join("\n").trim() + "\n"
}

/** Premier paragraphe du résumé, en texte simple (aperçu de l'accueil). */
export function summaryExcerpt(s?: CallSummary | null): string {
  if (!s) return ""
  const text = s.markdown
    .split("\n")
    .map((l) => (/^#{1,6}\s/.test(l) ? "" : l))
    .join("\n")
  for (const para of text.split(/\n\s*\n/)) {
    const p = para.trim()
    if (!p || /^([-*•>|]|\d+[.)])/.test(p)) continue
    return p.replace(/[*_`]/g, "").replace(/\s+/g, " ")
  }
  return ""
}

/** Ancien format (résumé découpé en champs), encore présent dans les données enregistrées avant le collage tel quel. */
export interface LegacySummary {
  essentials: string
  highlights: { label: string; value: string }[]
  decisions: string[]
  sections: { title: string; body: string }[]
  questions: string[]
  quotes: string[]
  vigilance: string[]
}

export function fromLegacy(s: Partial<LegacySummary>): CallSummary {
  const out: string[] = []
  const bullets = (title: string, items?: string[]) => items?.length && out.push(`## ${title}`, ...items.map((i) => `- ${i}`), "")
  if (s.essentials) out.push(s.essentials, "")
  if (s.highlights?.length) out.push("## Chiffres clés", ...s.highlights.map((h) => `- ${h.label} : ${h.value}`), "")
  bullets("Décisions", s.decisions)
  for (const sec of s.sections ?? []) out.push(`## ${sec.title}`, sec.body, "")
  bullets("Questions pour le prochain appel", s.questions)
  if (s.quotes?.length) out.push("## Phrases marquantes", ...s.quotes.flatMap((q) => [`> ${q}`, ""]))
  bullets("Points de vigilance", s.vigilance)
  return { markdown: out.join("\n").trim() }
}

/** Résumé lu depuis le stockage : nouveau format tel quel, ancien format converti. */
export function normalizeSummary(raw: unknown): CallSummary | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<LegacySummary> & { markdown?: unknown }
  return typeof r.markdown === "string" ? { markdown: r.markdown } : fromLegacy(r)
}
