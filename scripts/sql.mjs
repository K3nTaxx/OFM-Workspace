// Applique un fichier SQL sur la base Supabase avec la clé secrète de .env.local (outil exec_sql de schema.sql) :
// nouvelles tables, colonnes, règles… sans passer par le tableau de bord.
//
//   npm run sql -- supabase/schema.sql          → (re)passe tout le schéma (sans risque : tout est « if not exists »)
//   npm run sql -- supabase/ajout.sql           → un changement ponctuel
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { adminClient } from "./appels.mjs"

const file = process.argv[2] && resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2])
if (!file || !existsSync(file)) {
  console.error("Usage : npm run sql -- <fichier.sql>")
  process.exitCode = 1
} else {
  const { error } = await adminClient().rpc("exec_sql", { sql: readFileSync(file, "utf8") })
  if (error) {
    console.error(`✗ ${error.message}`)
    if (/exec_sql/.test(error.message)) console.error("  L'outil exec_sql n'est pas encore installé : passe une fois supabase/schema.sql dans le SQL Editor de Supabase.")
    process.exitCode = 1
  } else {
    console.log(`✓ ${process.argv[2]} appliqué`)
  }
}
