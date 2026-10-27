# Workspace OFM

Logiciel web interne de l'agence (version PC) : appels de mentorat avec résumé IA, calendrier, bibliothèque de PDF.
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
2. Copier `.env.example` en `.env.local` et remplir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API).
3. Créer les deux comptes, au choix :
   - ajouter `SUPABASE_SECRET_KEY` dans `.env.local`, puis `npm run create-users` ;
   - ou dans Supabase : **Authentication → Add user** (cocher « Auto confirm »), avec les e-mails et mots de
     passe de `IDENTIFIANTS.local.md`.
4. Dans Supabase : **Authentication → Sign In / Providers** → désactiver « Allow new users to sign up » (personne
   d'autre ne pourra créer de compte).

## Publier (GitHub + Netlify)

1. GitHub Desktop → **Add existing repository** → ce dossier `site` → **Publish repository** (garder « Private »).
2. Netlify → **Add new project → Import from Git** → choisir le dépôt. Les réglages de build sont déjà dans
   `netlify.toml` (rien à changer).
3. Netlify → **Site configuration → Environment variables**, ajouter :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que `.env.local`) ;
   - `ANTHROPIC_API_KEY` : clé de l'API Claude, pour l'analyse automatique des appels.
4. **Deploys → Trigger deploy**. Le site est en ligne, accessible seulement avec les deux comptes.

## Comment ça marche

- **Nouvel appel** (touche `N`) : glisser la transcription `.txt` (ou la coller). L'IA (Claude Opus 5.5) écrit le
  résumé complet, les actions, le titre, le type et les thèmes ; la fiche se remplit toute seule en une à deux
  minutes (`netlify/functions/analyze-call.mts`).
- **Recherche partout** : `Ctrl K`.
- **Bibliothèque** : glisser des PDF n'importe où dans un dossier ; double-clic ou `Espace` pour l'aperçu ;
  clic droit pour déplacer, télécharger, supprimer ; glisser un document sur une catégorie pour le ranger.
- **Wispr Flow** : pas encore d'API publique pour une connexion directe. Copier la transcription depuis Wispr Flow
  et la coller dans « Nouvel appel », ou demander à Claude d'importer le dernier appel.

## Structure

```
src/styles/      design system (tokens, composants, pages) — voir .claude/skills/workspace-ofm-design
src/components/  briques d'interface (miniatures, calendrier, menus, palette…)
src/pages/       Accueil, Appels, Fiche d'appel, Bibliothèque
src/features/    feuilles « Nouvel appel », « Ajouter un document », aperçu rapide
src/data/        modèle de données, mode démo, Supabase
netlify/         fonction d'analyse IA
supabase/        schéma SQL
```
