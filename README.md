# Workspace OFM

Logiciel web interne de l'agence (version PC) : appels de mentorat avec leur résumé et leur transcription, calendrier,
bibliothèque de PDF.
Deux comptes : Quentin et Logan. Identifiants dans `IDENTIFIANTS.local.md` (fichier local, jamais publié).

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Sans configuration, le site tourne en **mode démo** : fausses données,
tout reste dans le navigateur (deux onglets se synchronisent, pratique pour tester Quentin + Logan).

## Brancher la vraie base (Supabase)

1. Dans Supabase : **SQL Editor → New query**, coller tout `supabase/schema.sql`, puis **Run**.
2. Remplir `.env.local` (modèle : `.env.example`) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé publishable)
   et `SUPABASE_SECRET_KEY` (clé secrète, seulement pour l'étape suivante).
3. `npm run setup` : vérifie les tables et l'espace de fichiers, crée les deux comptes (`IDENTIFIANTS.local.md`) et
   importe les appels du dossier `import/` (`appel-01.md` + `Appel-01-transcription.txt`, jamais publiés).
   On peut le relancer sans risque.
4. Dans Supabase : **Authentication → Sign In / Providers** → désactiver « Allow new users to sign up » (personne
   d'autre ne pourra créer de compte).

## Publier (GitHub + Netlify)

1. GitHub Desktop → **Add existing repository** → ce dossier `site` → **Publish repository** (garder « Private »).
2. Netlify → **Add new project → Import from Git** → choisir le dépôt. Les réglages de build sont déjà dans
   `netlify.toml` (rien à changer).
3. Netlify → **Site configuration → Environment variables**, ajouter :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que `.env.local`). Jamais la clé secrète.
4. **Deploys → Trigger deploy**. Le site est en ligne, accessible seulement avec les deux comptes.

## Comment ça marche

- **Nouvel appel** (touche `N`) : deux zones à coller. **Résumé** (rédigé par Claude dans une conversation, au
  format du skill `.claude/skills/resume-appel-ofm`) : titre, date, type, intervenants, thèmes et actions se
  remplissent tout seuls. **Transcription** (copiée depuis Wispr Flow, ou un `.txt` glissé dessus) : devient le
  fichier `Appel-NN-transcription.txt`.
- **Fiche d'appel** : « Copier » / « Remplacer » le résumé, coller ou remplacer la transcription.
- **Recherche partout** : `Ctrl K`.
- **Bibliothèque** : glisser des PDF n'importe où dans un dossier ; double-clic ou `Espace` pour l'aperçu ;
  clic droit pour déplacer, télécharger, supprimer ; glisser un document sur une catégorie pour le ranger.

## Structure

```
src/styles/      design system (tokens, composants, pages) — voir .claude/skills/workspace-ofm-design
src/components/  briques d'interface (miniatures, calendrier, menus, palette…)
src/pages/       Accueil, Appels, Fiche d'appel, Bibliothèque
src/features/    feuilles « Nouvel appel », « Ajouter un document », aperçu rapide
src/data/        modèle de données, mode démo, Supabase
src/lib/         formats, lecture des résumés collés (summaryMarkdown.ts)
scripts/         npm run setup (comptes + import des appels)
supabase/        schéma SQL
public/          logo (généré par ../outils/logo.py)
```
