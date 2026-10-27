// Fausses données de démonstration (aucune donnée réelle de l'agence ici :
// ce fichier part sur GitHub).
import { addDays, format } from "date-fns"
import type { Call, Category, DocumentItem } from "./types"

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd")
const iso = (offset: number) => addDays(new Date(), offset).toISOString()

export const SEED_CATEGORIES: Category[] = [
  { id: "cat-chatting", name: "Chatting", color: "pink", position: 0 },
  { id: "cat-marketing", name: "Marketing & Trafic", color: "blue", position: 1 },
  { id: "cat-recrutement", name: "Recrutement", color: "green", position: 2 },
  { id: "cat-onboarding", name: "Onboarding", color: "purple", position: 3 },
  { id: "cat-juridique", name: "Juridique & Contrats", color: "red", position: 4 },
  { id: "cat-outils", name: "Outils & Process", color: "gray", position: 5 },
  { id: "cat-finance", name: "Finance", color: "yellow", position: 6 },
]

export function buildSeedCalls(): Call[] {
  return [
    {
      id: "call-1",
      number: 1,
      title: "Choix du marché et premières étapes",
      date: day(-8),
      time: "15:00",
      durationMin: 90,
      type: "mentorat",
      participants: ["Jules"],
      themes: ["Marchés", "Outreach", "Équipe & délégation"],
      videoUrl: null,
      hue: 222,
      status: "ready",
      transcript: { name: "Appel-01-transcription.txt", size: 0, path: "demo:transcript:call-1" },
      createdBy: "quentin",
      createdAt: iso(-8),
      updatedAt: iso(-8),
      actions: [
        { id: "a1", text: "Lire tous les PDF envoyés par Jules", owner: "Les deux", done: true },
        { id: "a2", text: "Lister nos questions par écrit", owner: "Les deux", done: true },
        { id: "a3", text: "Choisir le marché de lancement", owner: "Les deux", done: false },
        { id: "a4", text: "Préparer le compte de prospection", owner: "Logan", done: false },
      ],
      summary: {
        essentials:
          "Premier appel de mentorat : tour d'horizon des deux marchés possibles, de la façon de trouver des créatrices et de l'organisation à deux. Décision à prendre avant le prochain appel : le marché de lancement.",
        highlights: [
          { label: "Objectif", value: "10 K€ de CA d'ici la fin d'année" },
          { label: "Prochain appel", value: "Dans 2 jours" },
          { label: "Lancement", value: "Dans un mois" },
        ],
        decisions: [
          "Questions au mentor toujours par écrit, jamais en vocal.",
          "Un mois de théorie avant de lancer quoi que ce soit.",
          "On touche tous les deux à tout au début.",
        ],
        sections: [
          {
            title: "Les deux marchés",
            body:
              "| | Marché A | Marché B |\n| --- | --- | --- |\n| Démarrage | Rapide | Plus lent |\n| Stabilité | Faible | Forte |\n| Panier moyen | Plus bas | Plus haut |\n\nLe marché A sert de tremplin pour le cash flow, le marché B se prépare en parallèle.",
          },
          {
            title: "Trouver des créatrices",
            body:
              "- Le **ciblage des profils** compte plus que le volume de messages.\n- Une approche directe et professionnelle convertit mieux.\n- Les comptes « agence » génériques ne fonctionnent plus.",
          },
          {
            title: "Organisation",
            body: "- Déléguer dès que les premiers résultats arrivent.\n- Garder une vision commune : chacun connaît chaque partie du business.",
          },
        ],
        questions: ["Quel budget prévoir pour le setup ?", "Quel modèle de contrat utiliser ?"],
        quotes: ["« Tout se joue dans le ciblage. »"],
        vigilance: ["Contrat écrit et âge vérifié avant toute collaboration."],
      },
    },
    {
      id: "call-2",
      number: 2,
      title: "Organisation du workspace",
      date: day(-6),
      time: "18:30",
      durationMin: 40,
      type: "interne",
      participants: ["Quentin", "Logan"],
      themes: ["Équipe & délégation"],
      videoUrl: null,
      hue: 248,
      status: "ready",
      transcript: null,
      createdBy: "logan",
      createdAt: iso(-6),
      updatedAt: iso(-6),
      actions: [
        { id: "b1", text: "Ranger les PDF dans la bibliothèque", owner: "Quentin", done: true },
        { id: "b2", text: "Créer nos deux comptes", owner: "Quentin", done: true },
      ],
      summary: {
        essentials: "Point entre nous pour organiser l'espace de travail et répartir le rangement des ressources.",
        highlights: [
          { label: "Durée", value: "40 min" },
          { label: "Décision", value: "Un seul espace partagé" },
          { label: "Suite", value: "Point chaque dimanche" },
        ],
        decisions: ["Toutes les ressources vont dans la bibliothèque, classées par catégorie."],
        sections: [
          {
            title: "Répartition",
            body: "- **Quentin** : outils, workspace, montage.\n- **Logan** : prospection et relation partenaires.",
          },
        ],
        questions: [],
        quotes: [],
        vigilance: [],
      },
    },
    {
      id: "call-3",
      number: 3,
      title: "Questions sur le lancement d'un compte",
      date: day(-3),
      time: "14:30",
      durationMin: 60,
      type: "questions",
      participants: ["Jules", "Enzo"],
      themes: ["Réseaux & trafic", "No face & contenu"],
      videoUrl: null,
      hue: 210,
      status: "ready",
      transcript: { name: "Appel-03-transcription.txt", size: 0, path: "demo:transcript:call-3" },
      createdBy: "quentin",
      createdAt: iso(-3),
      updatedAt: iso(-3),
      actions: [
        { id: "c1", text: "Écrire le planning de publication de la première semaine", owner: "Logan", done: false },
        { id: "c2", text: "Tester trois formats de vidéo", owner: "Quentin", done: false },
      ],
      summary: {
        essentials:
          "Séance de questions-réponses sur la première semaine d'un nouveau compte : rythme de publication, formats et suivi des statistiques.",
        highlights: [
          { label: "Rythme", value: "3 vidéos par jour" },
          { label: "Rodage", value: "7 jours" },
          { label: "Suivi", value: "Stats chaque soir" },
        ],
        decisions: ["On documente chaque test dans la bibliothèque."],
        sections: [
          {
            title: "La première semaine",
            body: "1. Publier doucement pour habituer l'algorithme.\n2. Monter progressivement en rythme.\n3. Ajouter le lien seulement quand le compte est stable.",
          },
          { title: "Formats", body: "- Textes courts à l'écran.\n- Musiques tendance.\n- Une idée par vidéo." },
        ],
        questions: ["Combien de comptes par téléphone ?"],
        quotes: ["« Un compte se chauffe avant de se lancer. »"],
        vigilance: ["Respecter les règles de chaque plateforme pour éviter les blocages."],
      },
    },
    {
      id: "call-4",
      number: 4,
      title: "Stratégie de contenu",
      date: day(-1),
      time: "16:00",
      durationMin: 75,
      type: "mentorat",
      participants: ["Enzo"],
      themes: ["No face & contenu", "Monétisation"],
      videoUrl: null,
      hue: 232,
      status: "ready",
      transcript: { name: "Appel-04-transcription.txt", size: 0, path: "demo:transcript:call-4" },
      createdBy: "logan",
      createdAt: iso(-1),
      updatedAt: iso(-1),
      actions: [
        { id: "d1", text: "Préparer une banque de 30 idées de vidéos", owner: "Les deux", done: false },
        { id: "d2", text: "Fixer les prix des contenus", owner: "Logan", done: false },
        { id: "d3", text: "Monter un modèle de miniature réutilisable", owner: "Quentin", done: false },
      ],
      summary: {
        essentials:
          "Enzo a détaillé comment construire une ligne éditoriale régulière et comment structurer l'offre payante pour qu'elle reste simple.",
        highlights: [
          { label: "Banque d'idées", value: "30 vidéos d'avance" },
          { label: "Offre", value: "3 paliers de prix" },
          { label: "Prochain point", value: "Dans 1 semaine" },
        ],
        decisions: ["Une seule ligne éditoriale par compte."],
        sections: [
          { title: "Ligne éditoriale", body: "- Une niche claire.\n- Des formats répétables.\n- Une identité visuelle stable." },
          { title: "Offre payante", body: "Trois paliers simples, du plus accessible au plus exclusif. Pas de grille de prix compliquée." },
        ],
        questions: ["Comment mesurer la qualité du trafic ?"],
        quotes: ["« La régularité bat le talent. »"],
        vigilance: [],
      },
    },
    {
      id: "call-5",
      number: 5,
      title: "Point d'étape mensuel",
      date: day(4),
      time: "17:00",
      durationMin: 60,
      type: "mentorat",
      participants: ["Jules", "Enzo"],
      themes: [],
      videoUrl: null,
      hue: 198,
      status: "planned",
      transcript: null,
      createdBy: "quentin",
      createdAt: iso(-1),
      updatedAt: iso(-1),
      actions: [],
      summary: null,
    },
  ]
}

export function buildSeedDocuments(): DocumentItem[] {
  const doc = (
    id: string,
    title: string,
    categoryId: string,
    source: string,
    offset: number,
    callId: string | null = null,
  ): DocumentItem => ({
    id,
    title,
    categoryId,
    kind: "pdf",
    fileName: `${title}.pdf`,
    size: 120_000 + ([...title].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 2_400_000),
    path: `demo:pdf:${id}`,
    url: null,
    source,
    callId,
    createdBy: "quentin",
    createdAt: iso(offset),
  })

  return [
    doc("doc-1", "Guide de prospection", "cat-recrutement", "Jules", -8, "call-1"),
    doc("doc-2", "Bien cibler les profils", "cat-recrutement", "Jules", -8, "call-1"),
    doc("doc-3", "Rodage d'un compte Instagram", "cat-marketing", "Jules", -7, "call-3"),
    doc("doc-4", "Formats vidéo qui marchent", "cat-marketing", "Enzo", -1, "call-4"),
    doc("doc-5", "Scripts de conversation v2", "cat-chatting", "Jules", -5),
    doc("doc-6", "Modèle de contrat", "cat-juridique", "Nous", -4),
    doc("doc-7", "Checklist d'arrivée d'une créatrice", "cat-onboarding", "Nous", -4),
    doc("doc-8", "Suivi des commissions", "cat-finance", "Nous", -2),
    {
      id: "doc-9",
      title: "Notre stack d'outils",
      categoryId: "cat-outils",
      kind: "link",
      fileName: null,
      size: null,
      path: null,
      url: "https://www.notion.so",
      source: "Nous",
      callId: null,
      createdBy: "logan",
      createdAt: iso(-2),
    },
  ]
}

export const DEMO_TRANSCRIPT = (title: string) =>
  [
    `${title} — transcription de démonstration`,
    "",
    "Speaker 1: Salut les gars, ça va ? On peut commencer ?",
    "Speaker 2: Oui, c'est bon, on t'entend bien.",
    "Speaker 1: Parfait. Aujourd'hui on fait le point sur ce que vous avez lu et sur vos questions.",
    "Speaker 3: On a tout noté par écrit comme tu nous l'as demandé.",
    "Speaker 1: Top. Alors on commence par le plus important : le choix de votre marché.",
    "Speaker 2: On hésite encore entre les deux, on voulait ton avis sur le setup.",
    "Speaker 1: Je vous explique les avantages de chacun, et après vous décidez entre vous.",
    "Speaker 3: Ça marche.",
    "",
    "(Transcription fictive : les vraies transcriptions s'afficheront ici.)",
  ].join("\n")
