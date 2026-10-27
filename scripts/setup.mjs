// Prépare la base Supabase en une commande : vérifie les tables, l'espace de fichiers, crée (ou met à jour)
// les comptes de Quentin et Logan, puis importe les appels du dossier import/ (résumé .md + transcription .txt).
// Lancement : npm run setup   (lit .env.local : VITE_SUPABASE_URL + SUPABASE_SECRET_KEY)
// On peut le relancer sans risque : ce qui existe déjà n'est pas recréé.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { THUMB_HUES } from "../src/data/catalog.ts"
import { parseSummaryMarkdown } from "../src/lib/summaryMarkdown.ts"

const url = process.env.VITE_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("Il manque VITE_SUPABASE_URL ou SUPABASE_SECRET_KEY dans .env.local")
  process.exit(1)
}

const root = new URL("../", import.meta.url)
const admin = createClient(url, secret, { auth: { persistSession: false } })

// 1. Tables
const probe = await admin.from("calls").select("id, number")
if (probe.error) {
  console.error(`✗ Tables introuvables (${probe.error.message}).`)
  console.error("  Ouvre Supabase → SQL Editor → New query, colle tout le fichier supabase/schema.sql, clique Run, puis relance npm run setup.")
  process.exit(1)
}
console.log("✓ Tables en place")

// 2. Espace de fichiers privé
const bucket = await admin.storage.getBucket("files")
if (bucket.error) {
  const { error } = await admin.storage.createBucket("files", { public: false })
  console.log(error ? `✗ Espace de fichiers : ${error.message}` : "✓ Espace de fichiers créé")
} else {
  console.log("✓ Espace de fichiers en place")
}

// 3. Comptes (e-mails et mots de passe lus dans IDENTIFIANTS.local.md, jamais envoyé sur GitHub)
const accounts = readFileSync(new URL("IDENTIFIANTS.local.md", root), "utf8")
  .split("\n")
  .map((line) => line.match(/^\|\s*(\w+)\s*\|\s*(\S+@\S+)\s*\|\s*`([^`]+)`\s*\|/))
  .filter(Boolean)
  .map(([, name, email, password]) => ({ name, email, password }))

const { data: existing, error: listError } = await admin.auth.admin.listUsers()
if (listError) {
  console.error("✗ Comptes :", listError.message)
  process.exit(1)
}
for (const u of accounts) {
  const found = existing.users.find((x) => x.email === u.email)
  const { error } = found
    ? await admin.auth.admin.updateUserById(found.id, { password: u.password, user_metadata: { name: u.name } })
    : await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { name: u.name } })
  console.log(error ? `✗ Compte ${u.name} : ${error.message}` : `✓ Compte ${u.name} ${found ? "à jour" : "créé"}`)
}

// 4. Appels à importer : import/appel-01.md (+ import/Appel-01-transcription.txt)
const importDir = new URL("import/", root)
const files = existsSync(importDir) ? readdirSync(importDir).filter((f) => /^appel-\d+\.md$/i.test(f)).sort() : []
const taken = new Set(probe.data.map((c) => c.number))

for (const file of files) {
  const markdown = readFileSync(new URL(file, importDir), "utf8")
  const number = Number(markdown.match(/^#\s*Appel\s*#?\s*(\d+)/im)?.[1] ?? file.match(/\d+/)[0])
  if (taken.has(number)) {
    console.log(`• Appel #${number} déjà présent, ignoré`)
    continue
  }
  const { summary, actions, info } = parseSummaryMarkdown(markdown)
  const inserted = await admin
    .from("calls")
    .insert({
      number,
      title: info.title ?? "",
      date: info.date ?? new Date().toISOString().slice(0, 10),
      time: info.time ?? null,
      duration_min: info.durationMin ?? null,
      type: info.type ?? "mentorat",
      participants: info.participants ?? [],
      themes: info.themes ?? [],
      summary,
      actions,
      status: "ready",
      hue: THUMB_HUES[(number - 1) % THUMB_HUES.length],
      created_by: "quentin",
    })
    .select()
    .single()
  if (inserted.error) {
    console.log(`✗ Appel #${number} : ${inserted.error.message}`)
    continue
  }

  const pad = String(number).padStart(2, "0")
  const txtName = `Appel-${pad}-transcription.txt`
  const txt = new URL(txtName, importDir)
  if (existsSync(txt)) {
    const body = readFileSync(txt)
    const path = `transcripts/${inserted.data.id}/${Date.now()}-${txtName}`
    const up = await admin.storage.from("files").upload(path, body, { contentType: "text/plain; charset=utf-8" })
    if (up.error) console.log(`✗ Transcription #${number} : ${up.error.message}`)
    else await admin.from("calls").update({ transcript: { name: txtName, size: body.length, path } }).eq("id", inserted.data.id)
  }
  console.log(`✓ Appel #${number} importé : ${info.title}${existsSync(txt) ? " (+ transcription)" : ""}`)
}

console.log("\nTerminé. Lance le site (npm run dev) et connecte-toi.")
