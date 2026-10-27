// Envoie un appel dans la base (et donc sur le site, en ligne ou en local) : résumé .md + transcription .txt.
//
//   npm run appel -- import/resume.md import/transcription.txt          → crée l'appel suivant (#N automatique)
//   npm run appel -- --remplacer 3 import/resume.md [transcription.txt]  → met à jour l'appel #3
//
// Le titre, la date, l'heure, la durée, le type, les intervenants et les thèmes viennent du bloc « ## Infos » du
// résumé ; les actions de « ## Actions ». Une copie est rangée dans import/ (appel-NN.md, Appel-NN-transcription.txt).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { adminClient, pad, saveCall, transcriptName } from "./appels.mjs"

const args = process.argv.slice(2)
let replace = null
const files = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--remplacer") replace = Number(args[++i])
  else files.push(resolve(process.env.INIT_CWD ?? process.cwd(), args[i]))
}
const mdFile = files.find((f) => /\.(md|markdown)$/i.test(f))
const txtFile = files.find((f) => /\.txt$/i.test(f))
if (!mdFile || (replace !== null && !Number.isInteger(replace))) {
  console.error("Usage : npm run appel -- <résumé.md> [<transcription.txt>]   (ou --remplacer <numéro> …)")
  process.exit(1)
}
for (const f of [mdFile, txtFile].filter(Boolean)) {
  if (!existsSync(f)) {
    console.error(`Fichier introuvable : ${f}`)
    process.exit(1)
  }
}

const admin = adminClient()
const { data: calls, error } = await admin.from("calls").select("id, number, actions")
if (error) {
  console.error(`✗ Base injoignable : ${error.message}`)
  process.exit(1)
}

const existing = replace !== null ? calls.find((c) => c.number === replace) : null
if (replace !== null && !existing) {
  console.error(`✗ Aucun appel #${replace} dans la base.`)
  process.exit(1)
}
const number = existing?.number ?? Math.max(0, ...calls.map((c) => c.number)) + 1

const markdown = readFileSync(mdFile, "utf8")
const transcript = txtFile ? readFileSync(txtFile, "utf8") : ""
try {
  const call = await saveCall(admin, { number, markdown, transcript, existing })
  const [y, m, d] = call.date.split("-")
  const parts = [`${d}/${m}/${y}`, `${call.actions.length} action${call.actions.length > 1 ? "s" : ""}`]
  if (call.transcript) parts.push(`transcription ${Math.round(call.transcript.size / 1024)} Ko`)
  console.log(`✓ Appel #${call.number} ${existing ? "mis à jour" : "créé"} : ${call.title} — ${parts.join(" · ")}`)
  console.log(`  Fiche : /appels/${call.id}`)

  // Copie locale rangée sous le bon numéro (dossier import/, jamais envoyé sur GitHub)
  const archive = new URL("../import/", import.meta.url)
  mkdirSync(archive, { recursive: true })
  writeFileSync(new URL(`appel-${pad(call.number)}.md`, archive), markdown.replace(/^\s*#\s+(?:Appel\s*#?\s*\d+\s*[—–:-]\s*)?/, `# Appel #${call.number} — `))
  if (transcript) writeFileSync(new URL(transcriptName(call.number), archive), transcript)
} catch (e) {
  console.error(`✗ ${e.message}`)
  process.exit(1)
}
