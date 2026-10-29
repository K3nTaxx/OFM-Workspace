// Ajoute une note dans les notes personnelles de Quentin ou de Logan (visible tout de suite dans le site).
//
//   npm run note -- --compte quentin import/note.md                      → nouvelle note
//   npm run note -- --compte logan --ajouter "Questions pour Jules" import/note.md   → ajoutée à la fin d'une note
//   npm run note -- --compte quentin --liste                              → titres des notes du compte
//
// Le fichier est du Markdown simple : « # Titre », paragraphes, « - [ ] tâche », « - puce », « ## intertitre »,
// « ~~ligne barrée~~ ». C'est ce qu'écrit la conversation « Notes OFM » (skill notes-ofm).
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { TEAM } from "../src/data/team.ts"
import { markdownToNote } from "../src/lib/noteMarkdown.ts"
import { adminClient } from "./appels.mjs"

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const fold = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()

const member = TEAM.find((m) => m.id === fold(opt("--compte")))
if (!member) {
  console.error("Indique le compte : --compte quentin ou --compte logan")
  process.exitCode = 1
} else {
  await run(member)
}

async function run(member) {
  const admin = adminClient()
  const { data: users, error: usersError } = await admin.auth.admin.listUsers()
  if (usersError) return fail(`Comptes illisibles : ${usersError.message}`)
  const user = users.users.find((u) => u.email === member.email)
  if (!user) return fail(`Aucun compte ${member.name} dans la base (npm run setup)`)

  const { data: notes, error } = await admin.from("notes").select("id, title, blocks").eq("user_id", user.id).order("updated_at", { ascending: false })
  if (error) return fail(`Table des notes introuvable (${error.message}). Lance supabase/schema.sql dans Supabase.`)

  if (args.includes("--liste")) {
    console.log(`Notes de ${member.name} (${notes.length}) :`)
    for (const n of notes) console.log(`  - ${n.title || "(sans titre)"}`)
    return
  }

  const file = args.filter((a, i) => !a.startsWith("--") && !["--compte", "--ajouter"].includes(args[i - 1])).at(-1)
  const path = file && resolve(process.env.INIT_CWD ?? process.cwd(), file)
  if (!path || !existsSync(path)) return fail("Fichier de la note introuvable (ex. import/note.md)")
  const { title, blocks } = markdownToNote(readFileSync(path, "utf8"))

  const target = opt("--ajouter")
  if (target) {
    const note = notes.find((n) => n.id === target || fold(n.title) === fold(target))
    if (!note) return fail(`Aucune note « ${target} » chez ${member.name}`)
    // Le titre du texte ajouté devient un intertitre dans la note existante
    const added = title ? [{ id: crypto.randomUUID(), type: "heading", text: title }, ...blocks] : blocks
    const res = await admin.from("notes").update({ blocks: [...(note.blocks ?? []), ...added] }).eq("id", note.id)
    if (res.error) return fail(res.error.message)
    console.log(`✓ ${added.length} ligne${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""} à « ${note.title} » (${member.name})`)
    return
  }

  const res = await admin.from("notes").insert({ user_id: user.id, title, blocks }).select("id").single()
  if (res.error) return fail(res.error.message)
  const checks = blocks.filter((b) => b.type === "check").length
  console.log(`✓ Note créée pour ${member.name} : « ${title || "Sans titre"} » — ${blocks.length} lignes${checks ? `, ${checks} à cocher` : ""}`)
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
