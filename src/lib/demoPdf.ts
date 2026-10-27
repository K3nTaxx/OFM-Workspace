// Génère un vrai petit PDF d'une page (police Helvetica intégrée au lecteur),
// pour que l'aperçu fonctionne en mode démo sans fichier réel.

const toLatin1 = (s: string) =>
  s
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/œ/g, "oe")
    .replace(/[^\x00-\xff]/g, "")

const esc = (s: string) => toLatin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

export function makeDemoPdf(title: string, subtitle: string, paragraphs: string[]): Blob {
  const lines: string[] = []
  // Bandeau bleu nuit
  lines.push("0.09 0.13 0.27 rg 0 762 595 80 re f")
  lines.push("0.18 0.36 0.83 rg 0 760 595 2 re f")
  lines.push(`BT 1 1 1 rg /F1 22 Tf 48 800 Td (${esc(title)}) Tj ET`)
  lines.push(`BT 0.75 0.8 0.95 rg /F2 10 Tf 48 780 Td (${esc(subtitle)}) Tj ET`)

  let y = 720
  lines.push("0.15 0.15 0.18 rg")
  for (const p of paragraphs) {
    const words = toLatin1(p).split(" ")
    let current = ""
    const wrapped: string[] = []
    for (const w of words) {
      if ((current + " " + w).trim().length > 88) {
        wrapped.push(current.trim())
        current = w
      } else current += " " + w
    }
    if (current.trim()) wrapped.push(current.trim())
    for (const l of wrapped) {
      lines.push(`BT /F2 11 Tf 48 ${y} Td (${esc(l)}) Tj ET`)
      y -= 16
    }
    y -= 10
  }
  lines.push(`BT 0.55 0.55 0.6 rg /F2 8 Tf 48 40 Td (Document de demonstration - Workspace OFM) Tj ET`)

  const stream = lines.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ]

  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`

  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return new Blob([bytes], { type: "application/pdf" })
}
