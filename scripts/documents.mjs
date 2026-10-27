// Range des fichiers (PDF, images, vidéos, textes, tout type) et des liens dans la bibliothèque du site, en lot.
//
//   npm run documents -- --liste                  → catégories et documents déjà rangés
//   npm run documents -- import/documents.json    → envoie les fichiers décrits dans le fichier JSON
//
// Le JSON est une liste : [{ "fichier": "…/Guide.pdf", "titre": "Guide de prospection", "categorie": "Recrutement",
//   "source": "Jules", "appel": 3 }, { "lien": "https://…", "titre": "…", "categorie": "…" }]
// (source et appel facultatifs ; appel = numéro de l'appel lié ; « lien » à la place de « fichier » pour une adresse web)
// Une catégorie qui n'existe pas encore est créée. Un fichier déjà présent (même nom, même taille) ou un lien déjà
// enregistré est ignoré.
// Les fichiers venant du dossier « À ranger » y sont ensuite déplacés dans « Rangés/<catégorie> ».
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { CATEGORY_COLORS } from "../src/data/catalog.ts"
import { adminClient } from "./appels.mjs"

const DROP = resolve(dirname(fileURLToPath(import.meta.url)), "../../À ranger")

const fold = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const safeName = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")

// Type affiché dans le site et type MIME (pour que le navigateur sache l'ouvrir)
const TYPES = {
  ".pdf": ["pdf", "application/pdf"],
  ".png": ["image", "image/png"],
  ".jpg": ["image", "image/jpeg"],
  ".jpeg": ["image", "image/jpeg"],
  ".webp": ["image", "image/webp"],
  ".gif": ["image", "image/gif"],
  ".avif": ["image", "image/avif"],
  ".svg": ["image", "image/svg+xml"],
  ".mp4": ["video", "video/mp4"],
  ".mov": ["video", "video/quicktime"],
  ".webm": ["video", "video/webm"],
  ".txt": ["text", "text/plain; charset=utf-8"],
  ".md": ["text", "text/markdown; charset=utf-8"],
  ".csv": ["text", "text/csv; charset=utf-8"],
  ".mp3": ["other", "audio/mpeg"],
  ".m4a": ["other", "audio/mp4"],
  ".wav": ["other", "audio/wav"],
  ".docx": ["other", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xlsx": ["other", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".pptx": ["other", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".zip": ["other", "application/zip"],
}

const admin = adminClient()
const [{ data: categories, error: catError }, { data: documents, error: docError }] = await Promise.all([
  admin.from("categories").select("*").order("position"),
  admin.from("documents").select("id, title, file_name, size, url, category_id"),
])
if (catError || docError) {
  console.error(`✗ Base injoignable : ${(catError ?? docError).message}`)
  process.exit(1)
}

const args = process.argv.slice(2)

if (args[0] === "--liste") {
  for (const cat of [...categories, { id: null, name: "Sans catégorie" }]) {
    const docs = documents.filter((d) => d.category_id === cat.id)
    if (!cat.id && !docs.length) continue
    console.log(`\n${cat.name} (${docs.length})`)
    for (const d of docs) console.log(`  - ${d.title}${d.file_name ? `  [${d.file_name}]` : d.url ? `  <${d.url}>` : ""}`)
  }
  process.exit(0)
}

const manifestPath = args[0] && resolve(process.env.INIT_CWD ?? process.cwd(), args[0])
if (!manifestPath || !existsSync(manifestPath)) {
  console.error("Usage : npm run documents -- --liste   |   npm run documents -- <documents.json>")
  process.exit(1)
}
const entries = JSON.parse(readFileSync(manifestPath, "utf8"))
const base = dirname(manifestPath)

let calls = null
async function callId(number) {
  calls ??= (await admin.from("calls").select("id, number")).data ?? []
  return calls.find((c) => c.number === Number(number))?.id ?? null
}

async function category(name) {
  const found = categories.find((c) => fold(c.name) === fold(name))
  if (found) return found
  const res = await admin
    .from("categories")
    .insert({ name: name.trim(), color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length], position: categories.length })
    .select()
    .single()
  if (res.error) throw new Error(`catégorie « ${name} » : ${res.error.message}`)
  categories.push(res.data)
  console.log(`+ Catégorie créée : ${res.data.name}`)
  return res.data
}

let added = 0
for (const entry of entries) {
  if (entry.lien) {
    try {
      const url = String(entry.lien).trim()
      if (!/^https?:\/\//.test(url)) throw new Error("adresse invalide (doit commencer par https://)")
      if (documents.some((d) => d.url === url)) {
        console.log(`• Déjà rangé : ${url}`)
        continue
      }
      const cat = entry.categorie ? await category(entry.categorie) : null
      const row = {
        title: (entry.titre ?? url.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0]).trim(),
        category_id: cat?.id ?? null,
        kind: "link",
        url,
        source: entry.source ?? null,
        call_id: entry.appel ? await callId(entry.appel) : null,
        created_by: "quentin",
      }
      const res = await admin.from("documents").insert(row)
      if (res.error) throw new Error(res.error.message)
      documents.push(row)
      added++
      console.log(`✓ ${row.title} (lien) → ${cat?.name ?? "Sans catégorie"}`)
    } catch (e) {
      console.log(`✗ ${entry.lien} : ${e.message}`)
    }
    continue
  }

  const file = resolve(base, entry.fichier ?? "")
  const name = basename(file)
  try {
    if (!entry.fichier || !existsSync(file)) throw new Error("fichier introuvable")
    const size = statSync(file).size
    if (documents.some((d) => d.file_name === name && Number(d.size) === size)) {
      console.log(`• Déjà rangé : ${name}`)
      continue
    }
    const cat = entry.categorie ? await category(entry.categorie) : null
    const [kind, contentType] = TYPES[extname(name).toLowerCase()] ?? ["other", "application/octet-stream"]
    const id = crypto.randomUUID()
    const path = `documents/${id}/${safeName(name)}`
    const up = await admin.storage.from("files").upload(path, readFileSync(file), { contentType })
    if (up.error) throw new Error(up.error.message)
    const row = {
      id,
      title: (entry.titre ?? name.replace(/\.[^.]+$/, "")).trim(),
      category_id: cat?.id ?? null,
      kind,
      file_name: name,
      size,
      path,
      source: entry.source ?? null,
      call_id: entry.appel ? await callId(entry.appel) : null,
      created_by: "quentin",
    }
    const res = await admin.from("documents").insert(row)
    if (res.error) {
      await admin.storage.from("files").remove([path])
      throw new Error(res.error.message)
    }
    documents.push(row)
    added++
    console.log(`✓ ${row.title} → ${cat?.name ?? "Sans catégorie"}${entry.appel ? ` (lié à l'appel #${entry.appel})` : ""}`)

    // Rangement local : les fichiers du dossier « À ranger » passent dans « Rangés/<catégorie> »
    if (dirname(file) === DROP) {
      const dest = join(DROP, "Rangés", (cat?.name ?? "Sans catégorie").replace(/[\\/:*?"<>|]/g, "-"))
      mkdirSync(dest, { recursive: true })
      renameSync(file, join(dest, name))
    }
  } catch (e) {
    console.log(`✗ ${name || entry.fichier} : ${e.message}`)
  }
}
console.log(`\n${added} document${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à la bibliothèque.`)
