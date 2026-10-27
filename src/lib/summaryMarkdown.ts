// Lit un résumé collé (Markdown, format du skill « resume-appel-ofm ») et le découpe en résumé structuré,
// actions et infos de l'appel. Et l'inverse : reconstruit le Markdown depuis un appel (copier / tout modifier).
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

type Key = "info" | "essentials" | "highlights" | "decisions" | "actions" | "questions" | "quotes" | "vigilance"

function keyFor(heading: string): Key | null {
  const h = fold(cleanHeading(heading))
  if (/^(infos?|informations|details)\b/.test(h)) return "info"
  if (/^(l'?essentiel|resume|en bref|synthese)\b/.test(h)) return "essentials"
  if (/^(chiffres cles|en chiffres|reperes|a retenir en chiffres)/.test(h)) return "highlights"
  if (/^decisions?\b/.test(h)) return "decisions"
  if (/^(actions?|a faire|ce qu'on doit faire|prochaines etapes|taches)\b/.test(h)) return "actions"
  if (/^questions?\b/.test(h)) return "questions"
  if (/^(phrases marquantes|citations?)\b/.test(h)) return "quotes"
  if (/^(points? de vigilance|vigilance)\b/.test(h)) return "vigilance"
  return null
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

function parseDate(v: string): string | undefined {
  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const fr = v.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/)
  if (fr) {
    const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3]
    return `${y}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`
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

export function parseSummaryMarkdown(md: string): ParsedSummary {
  const summary: CallSummary = { essentials: "", highlights: [], decisions: [], sections: [], questions: [], quotes: [], vigilance: [] }
  const actions: ActionItem[] = []
  const info: ParsedInfo = {}

  // On retire un éventuel bloc de code englobant (copie depuis une conversation)
  const text = md.replace(/^\s*```(?:markdown|md)?\s*\n/, "").replace(/\n```\s*$/, "").replace(/\r\n/g, "\n")

  const blocks: { heading: string | null; body: string[] }[] = [{ heading: null, body: [] }]
  for (const line of text.split("\n")) {
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    if (h1 && !info.title) {
      info.title = h1[1].replace(/^appel\s*#?\s*\d+\s*[—–:-]\s*/i, "").trim()
      continue
    }
    if (h2) blocks.push({ heading: h2[1].trim(), body: [] })
    else blocks[blocks.length - 1].body.push(line)
  }

  for (const block of blocks) {
    const body = block.body.join("\n").trim()
    if (block.heading === null) {
      if (!body) continue
      // Texte libre sans titres « ## » : le 1er paragraphe devient l'essentiel, le reste une section
      const [first, ...rest] = body.split(/\n\s*\n/)
      summary.essentials = first.trim()
      if (rest.length) summary.sections.push({ title: "Notes", body: rest.join("\n\n").trim() })
      continue
    }
    const key = keyFor(block.heading)
    switch (key) {
      case "info":
        parseInfo(body, info)
        break
      case "essentials":
        summary.essentials = body
        break
      case "highlights":
        summary.highlights = listItems(body)
          .map(splitKV)
          .filter((x): x is { key: string; value: string } => !!x)
          .map((x) => ({ label: x.key, value: x.value }))
        break
      case "decisions":
        summary.decisions = listItems(body)
        break
      case "actions":
        actions.push(...listItems(body).map(parseAction))
        break
      case "questions":
        summary.questions = listItems(body)
        break
      case "quotes":
        summary.quotes = listItems(body)
        break
      case "vigilance":
        summary.vigilance = listItems(body)
        break
      default:
        summary.sections.push({ title: cleanHeading(block.heading), body })
    }
  }

  return { summary, actions, info }
}

/** Petit compte rendu de ce qui a été reconnu, affiché pendant le collage. */
export function describeParsed(p: ParsedSummary) {
  const parts: string[] = []
  if (p.summary.essentials) parts.push("L'essentiel")
  if (p.summary.sections.length) parts.push(`${p.summary.sections.length} section${p.summary.sections.length > 1 ? "s" : ""}`)
  if (p.actions.length) parts.push(`${p.actions.length} action${p.actions.length > 1 ? "s" : ""}`)
  if (p.summary.decisions.length) parts.push(`${p.summary.decisions.length} décision${p.summary.decisions.length > 1 ? "s" : ""}`)
  if (p.info.type) parts.push(`type ${callType(p.info.type).label}`)
  if (p.info.themes?.length) parts.push(`${p.info.themes.length} thème${p.info.themes.length > 1 ? "s" : ""}`)
  return parts
}

export function summaryToMarkdown(call: Call): string {
  const s = call.summary
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
  if (!s) return out.join("\n")
  const bullets = (title: string, items: string[]) => {
    if (!items.length) return
    out.push(`## ${title}`, ...items.map((i) => `- ${i}`), "")
  }
  if (s.essentials) out.push("## L'essentiel", s.essentials, "")
  if (s.highlights.length) out.push("## Chiffres clés", ...s.highlights.map((h) => `- ${h.label} : ${h.value}`), "")
  bullets("Décisions", s.decisions)
  if (call.actions.length) {
    out.push("## Actions", ...call.actions.map((a) => `- [${a.done ? "x" : " "}] ${a.text}${a.owner ? ` — ${a.owner}` : ""}`), "")
  }
  for (const sec of s.sections) out.push(`## ${sec.title}`, sec.body, "")
  bullets("Questions pour le prochain appel", s.questions)
  bullets("Phrases marquantes", s.quotes)
  bullets("Points de vigilance", s.vigilance)
  return out.join("\n").trim() + "\n"
}
