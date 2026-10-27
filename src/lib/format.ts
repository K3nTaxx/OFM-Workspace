import { format, formatDistanceToNowStrict, isToday, isTomorrow, isValid, isYesterday, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

export const parseDay = (d: string) => parseISO(d.length === 10 ? `${d}T12:00:00` : d)

/** Vrai pour une vraie date « AAAA-MM-JJ » (le 31 septembre n'existe pas). */
export const isValidDay = (d?: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && isValid(parseDay(d)) && fmt(d, "yyyy-MM-dd") === d

// Une date invalide (donnée abîmée) s'affiche « Date inconnue » au lieu de faire planter l'écran
export const fmt = (d: string | Date, pattern: string) => {
  const date = typeof d === "string" ? parseDay(d) : d
  return isValid(date) ? format(date, pattern, { locale: fr }) : "Date inconnue"
}

/** « Aujourd'hui », « Hier », « Demain » ou « mar. 27 oct. » */
export function relativeDay(d: string) {
  const date = parseDay(d)
  if (!isValid(date)) return "Date inconnue"
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return "Hier"
  if (isTomorrow(date)) return "Demain"
  return format(date, "EEE d MMM", { locale: fr })
}

export const longDay = (d: string) => {
  const s = fmt(d, "EEEE d MMMM yyyy")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const ago = (iso: string) => (isValid(parseISO(iso)) ? formatDistanceToNowStrict(parseISO(iso), { locale: fr, addSuffix: true }) : "—")

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
