import type { CallType, TagColor } from "./types"

export const CALL_TYPES: { id: CallType; label: string; color: TagColor }[] = [
  { id: "mentorat", label: "Mentorat", color: "purple" },
  { id: "decouverte", label: "Découverte", color: "blue" },
  { id: "questions", label: "Questions-réponses", color: "orange" },
  { id: "interne", label: "Entre nous", color: "gray" },
]

export const callType = (id: CallType) => CALL_TYPES.find((t) => t.id === id) ?? CALL_TYPES[0]

export const THEMES: { label: string; color: TagColor }[] = [
  { label: "Marchés", color: "blue" },
  { label: "Outreach", color: "green" },
  { label: "Réseaux & trafic", color: "pink" },
  { label: "No face & contenu", color: "purple" },
  { label: "Chatting", color: "orange" },
  { label: "Monétisation", color: "yellow" },
  { label: "Fiscalité & légal", color: "red" },
  { label: "Équipe & délégation", color: "brown" },
  { label: "Partenariats", color: "gray" },
]

export const themeColor = (label: string): TagColor =>
  THEMES.find((t) => t.label.toLowerCase() === label.toLowerCase())?.color ?? "gray"

export const PEOPLE = ["Jules", "Enzo", "Quentin", "Logan"]

export const OWNERS = ["Quentin", "Logan", "Les deux", "Jules", "Enzo"]

export const DOC_SOURCES = ["Jules", "Enzo", "Nous", "Formation", "Internet"]

export const CATEGORY_COLORS: TagColor[] = ["blue", "green", "pink", "purple", "red", "orange", "yellow", "brown", "gray"]

/** Teintes proposées pour les miniatures (degrés HSL), toutes dans la famille bleu nuit. */
export const THUMB_HUES = [222, 232, 210, 248, 198, 262]
