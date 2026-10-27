// Crée (ou met à jour) les comptes de Quentin et Logan dans Supabase.
// Les e-mails et mots de passe sont lus dans IDENTIFIANTS.local.md (jamais envoyé sur GitHub).
// Lancement : npm run create-users   (lit .env.local : VITE_SUPABASE_URL + SUPABASE_SECRET_KEY)
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const url = process.env.VITE_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("Il manque VITE_SUPABASE_URL ou SUPABASE_SECRET_KEY dans .env.local")
  process.exit(1)
}

const rows = readFileSync(new URL("../IDENTIFIANTS.local.md", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.match(/^\|\s*(\w+)\s*\|\s*(\S+@\S+)\s*\|\s*`([^`]+)`\s*\|/))
  .filter(Boolean)
  .map(([, name, email, password]) => ({ name, email, password }))

if (rows.length === 0) {
  console.error("Aucun identifiant trouvé dans IDENTIFIANTS.local.md")
  process.exit(1)
}

const admin = createClient(url, secret, { auth: { persistSession: false } })
const { data: existing, error: listError } = await admin.auth.admin.listUsers()
if (listError) {
  console.error("Connexion à Supabase impossible :", listError.message)
  process.exit(1)
}

for (const u of rows) {
  const found = existing.users.find((x) => x.email === u.email)
  const { error } = found
    ? await admin.auth.admin.updateUserById(found.id, { password: u.password, user_metadata: { name: u.name } })
    : await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { name: u.name } })
  console.log(error ? `✗ ${u.name} : ${error.message}` : `✓ ${u.name} (${u.email}) ${found ? "mis à jour" : "créé"}`)
}
