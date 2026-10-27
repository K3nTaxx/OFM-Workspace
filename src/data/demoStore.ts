// Mode démo : tout est stocké dans le navigateur (localStorage + IndexedDB).
// Deux onglets ouverts (Quentin et Logan) se synchronisent entre eux.
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval"
import { makeDemoPdf } from "../lib/demoPdf"
import { normalizeSummary } from "../lib/summaryMarkdown"
import { SEED_CATEGORIES, buildSeedCalls, buildSeedDocuments, DEMO_TRANSCRIPT } from "./seed"
import type { Call, CallInput, Category, DataStore, DocumentInput, DocumentItem, TranscriptFile } from "./types"

const KEY = "ofm.demo.v1"

interface DemoState {
  calls: Call[]
  categories: Category[]
  documents: DocumentItem[]
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export function createDemoStore(currentMember: () => string | null): DataStore {
  const listeners = new Set<() => void>()

  const load = (): DemoState => {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      try {
        const state = JSON.parse(raw) as DemoState
        state.calls = state.calls.map((c) => ({ ...c, summary: normalizeSummary(c.summary) }))
        return state
      } catch {
        /* état corrompu : on repart des données de démo */
      }
    }
    const seeded: DemoState = { calls: buildSeedCalls(), categories: SEED_CATEGORIES, documents: buildSeedDocuments() }
    localStorage.setItem(KEY, JSON.stringify(seeded))
    return seeded
  }

  let state = load()

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state))
    listeners.forEach((l) => l())
  }

  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = load()
      listeners.forEach((l) => l())
    }
  })

  const fileUrl = async (path: string, fallback: () => Blob): Promise<string> => {
    const stored = await idbGet<Blob>(`file:${path}`)
    return URL.createObjectURL(stored ?? fallback())
  }

  const store: DataStore = {
    mode: "demo",

    async listCalls() {
      return [...state.calls]
    },

    async createCall(input: CallInput) {
      const call: Call = {
        id: uid(),
        number: input.number ?? Math.max(0, ...state.calls.map((c) => c.number)) + 1,
        title: input.title ?? "",
        date: input.date ?? new Date().toISOString().slice(0, 10),
        time: input.time ?? null,
        durationMin: input.durationMin ?? null,
        type: input.type ?? "mentorat",
        participants: input.participants ?? [],
        themes: input.themes ?? [],
        videoUrl: input.videoUrl ?? null,
        summary: input.summary ?? null,
        actions: input.actions ?? [],
        transcript: input.transcript ?? null,
        status: input.status ?? "ready",
        hue: input.hue ?? 222,
        createdBy: currentMember(),
        createdAt: now(),
        updatedAt: now(),
      }
      state = { ...state, calls: [...state.calls, call] }
      save()
      return call
    },

    async updateCall(id, patch) {
      let updated: Call | undefined
      state = {
        ...state,
        calls: state.calls.map((c) => (c.id === id ? (updated = { ...c, ...patch, updatedAt: now() }) : c)),
      }
      save()
      if (!updated) throw new Error("Appel introuvable")
      return updated
    },

    async deleteCall(id) {
      const call = state.calls.find((c) => c.id === id)
      if (call?.transcript?.path) await idbDel(`file:${call.transcript.path}`)
      state = {
        ...state,
        calls: state.calls.filter((c) => c.id !== id),
        documents: state.documents.map((d) => (d.callId === id ? { ...d, callId: null } : d)),
      }
      save()
    },

    async uploadTranscript(callId, file, name) {
      const path = `transcripts/${callId}/${name}`
      await idbSet(`file:${path}`, file)
      return { name, size: file.size, path } satisfies TranscriptFile
    },

    async readTranscript(call) {
      if (!call.transcript) return ""
      const stored = await idbGet<Blob>(`file:${call.transcript.path}`)
      return stored ? stored.text() : DEMO_TRANSCRIPT(call.title)
    },

    async listCategories() {
      return [...state.categories].sort((a, b) => a.position - b.position)
    },

    async createCategory(input) {
      const cat: Category = { ...input, id: uid() }
      state = { ...state, categories: [...state.categories, cat] }
      save()
      return cat
    },

    async updateCategory(id, patch) {
      let updated: Category | undefined
      state = { ...state, categories: state.categories.map((c) => (c.id === id ? (updated = { ...c, ...patch }) : c)) }
      save()
      if (!updated) throw new Error("Catégorie introuvable")
      return updated
    },

    async deleteCategory(id) {
      state = {
        ...state,
        categories: state.categories.filter((c) => c.id !== id),
        documents: state.documents.map((d) => (d.categoryId === id ? { ...d, categoryId: null } : d)),
      }
      save()
    },

    async listDocuments() {
      return [...state.documents]
    },

    async createDocument(input: DocumentInput, file) {
      const id = uid()
      let path: string | null = null
      if (file) {
        path = `documents/${id}/${input.fileName ?? "fichier"}`
        await idbSet(`file:${path}`, file)
      }
      const doc: DocumentItem = {
        id,
        title: input.title ?? "Sans titre",
        categoryId: input.categoryId ?? null,
        kind: input.kind ?? "other",
        fileName: input.fileName ?? null,
        size: file?.size ?? input.size ?? null,
        path,
        url: input.url ?? null,
        source: input.source ?? null,
        callId: input.callId ?? null,
        createdBy: currentMember(),
        createdAt: now(),
      }
      state = { ...state, documents: [...state.documents, doc] }
      save()
      return doc
    },

    async updateDocument(id, patch) {
      let updated: DocumentItem | undefined
      state = {
        ...state,
        documents: state.documents.map((d) => (d.id === id ? (updated = { ...d, ...patch }) : d)),
      }
      save()
      if (!updated) throw new Error("Document introuvable")
      return updated
    },

    async deleteDocument(doc) {
      if (doc.path) await idbDel(`file:${doc.path}`)
      state = { ...state, documents: state.documents.filter((d) => d.id !== doc.id) }
      save()
    },

    async getFileUrl(doc) {
      if (doc.kind === "link") return doc.url ?? null
      if (!doc.path) return null
      const category = state.categories.find((c) => c.id === doc.categoryId)
      return fileUrl(doc.path, () =>
        makeDemoPdf(doc.title, `${category?.name ?? "Bibliothèque"} - source : ${doc.source ?? "Nous"}`, [
          "Ce document est un exemple généré pour la démonstration du Workspace OFM.",
          "Glisse tes vrais fichiers dans la bibliothèque : ils remplaceront ces exemples et seront rangés dans la bonne catégorie.",
          "Chaque document peut être relié à l'appel dont il provient, pour tout retrouver au même endroit.",
        ]),
      )
    },

    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }

  return store
}

export function resetDemo() {
  localStorage.removeItem(KEY)
}
