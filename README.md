# OFM Workspace

Logiciel web interne de l'agence (version PC) : appels de mentorat avec leur résumé et leur transcription, calendrier,
bibliothèque de PDF.
Deux comptes : Quentin et Logan. Identifiants dans `IDENTIFIANTS.local.md` (fichier local, jamais publié).

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173 (ou double-clic sur `Lancer Workspace OFM.bat`, dans le dossier OFM). Avec
`.env.local` rempli, le site utilise la vraie base Supabase ; sans, il tourne en **mode démo** (fausses données
gardées dans le navigateur).

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

Dépôt : https://github.com/K3nTaxx/OFM-Workspace

1. Netlify → **Add new project → Import an existing project → GitHub** → choisir `OFM-Workspace` → **Deploy**.
   Rien à régler : la commande de build, le dossier `dist`, la version de Node et la connexion à Supabase (URL +
   clé publique) sont déjà dans `netlify.toml`.
2. Chaque `git push` sur `main` republie le site tout seul.

La clé secrète n'est jamais sur GitHub ni sur Netlify : elle reste dans `.env.local` (scripts lancés en local).

## Ajouter un appel sans ouvrir le site

```bash
npm run appel -- import/resume.md import/transcription.txt
```

Crée l'appel suivant dans la base (numéro automatique) : infos lues dans `## Infos`, résumé, actions et transcription
`Appel-NN-transcription.txt`. C'est ce que lance la conversation « Résumés des appels OFM » (skill
`.claude/skills/resume-appel-ofm`). Corriger un appel existant : `npm run appel -- --remplacer N import/resume.md`.

## Ranger des fichiers en lot

```bash
npm run documents -- --liste                  # catégories et documents déjà rangés
npm run documents -- import/documents.json    # envoie les fichiers décrits (titre, catégorie, source, appel)
```

Crée les catégories manquantes, ignore les doublons, et range les fichiers du dossier `../À ranger` dans
`À ranger/Rangés/<catégorie>`. C'est ce qu'utilise la conversation « Rangement des documents OFM » (skill
`.claude/skills/ranger-documents-ofm`).

## Comment ça marche

- **Nouvel appel** (touche `N`) : deux zones à coller. **Résumé** (format du skill `resume-appel-ofm`) : titre,
  date, type, intervenants, thèmes et actions se remplissent tout seuls. **Transcription** (copiée depuis Wispr
  Flow, ou un `.txt` glissé dessus) : devient le fichier `Appel-NN-transcription.txt`.
- **Fiche d'appel** : le résumé s'affiche tel qu'il a été collé ; « Copier » / « Modifier », coller ou remplacer
  la transcription. Les actions se cochent dans le résumé comme dans l'onglet Actions.
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
scripts/         npm run setup (comptes + import), npm run appel (ajouter un appel), npm run documents (ranger des fichiers)
supabase/        schéma SQL
public/          logo (généré par ../outils/logo.py)
```
