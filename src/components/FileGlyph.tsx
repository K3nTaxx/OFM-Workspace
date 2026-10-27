import { LinkSimpleIcon } from "@phosphor-icons/react"
import type { DocumentItem, DocumentKind, TagColor } from "../data/types"

const LABEL: Record<DocumentKind, string> = {
  pdf: "PDF",
  image: "IMG",
  video: "VID",
  link: "LIEN",
  text: "TXT",
  other: "FIC",
}

export function kindFromFile(f: File): DocumentKind {
  if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) return "pdf"
  if (f.type.startsWith("image/")) return "image"
  if (f.type.startsWith("video/")) return "video"
  if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name)) return "text"
  return "other"
}

/** Icône de fichier dessinée (page cornée + étiquette de type), teintée par la catégorie. */
/** Étiquette : le type, ou l'extension réelle pour les autres fichiers (DOCX, ZIP, MP3…). */
const labelOf = (doc: Pick<DocumentItem, "kind" | "fileName">) =>
  doc.kind === "other" ? (doc.fileName?.match(/\.([a-z0-9]{2,4})$/i)?.[1].toUpperCase() ?? LABEL.other) : LABEL[doc.kind]

export function FileGlyph({ doc, color = "gray", small }: { doc: Pick<DocumentItem, "kind" | "fileName">; color?: TagColor; small?: boolean }) {
  if (doc.kind === "link") {
    return (
      <span className={`file-glyph file-glyph--link${small ? " file-glyph--sm" : ""}`} data-color={color}>
        <LinkSimpleIcon size={small ? 13 : 26} />
      </span>
    )
  }
  return (
    <span className={`file-glyph${small ? " file-glyph--sm" : ""}`} data-color={color} data-kind={doc.kind}>
      <svg viewBox="0 0 48 60" aria-hidden>
        <path className="fg-page" d="M6 2h26l14 14v38a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
        <path className="fg-fold" d="M32 2v10a4 4 0 0 0 4 4h10" />
        {!small && (
          <>
            <rect className="fg-line" x="10" y="26" width="24" height="2.4" rx="1.2" />
            <rect className="fg-line" x="10" y="32" width="28" height="2.4" rx="1.2" />
            <rect className="fg-line" x="10" y="38" width="20" height="2.4" rx="1.2" />
          </>
        )}
      </svg>
      {!small && <span className="file-glyph-label">{labelOf(doc)}</span>}
    </span>
  )
}
