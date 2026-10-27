import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

export const parseDay = (d: string) => parseISO(d.length === 10 ? `${d}T12:00:00` : d)

export const fmt = (d: string | Date, pattern: string) =>
  format(typeof d === "string" ? parseDay(d) : d, pattern, { locale: fr })

/** « Aujourd'hui », « Hier », « Demain » ou « mar. 27 oct. » */
export function relativeDay(d: string) {
  const date = parseDay(d)
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return "Hier"
  if (isTomorrow(date)) return "Demain"
  return format(date, "EEE d MMM", { locale: fr })
}

export const longDay = (d: string) => {
  const s = fmt(d, "EEEE d MMMM yyyy")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { locale: fr, addSuffix: true })

export function duration(min?: number | null) {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`
}

export function fileSize(bytes?: number | null) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}

export function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 5 || h >= 18) return `Bonsoir, ${name}`
  return `Bonjour, ${name}`
}

export const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
export const modKey = isMac ? "⌘" : "Ctrl"

export function youtubeEmbed(url?: string | null) {
  if (!url) return null
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{6,})/)
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1` : null
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Nom du fichier .txt d'une transcription : « Appel-01-transcription.txt ». */
export const transcriptFileName = (n: number) => `Appel-${String(n).padStart(2, "0")}-transcription.txt`
