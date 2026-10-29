// Mode connecté : Supabase (base Postgres + fichiers + temps réel entre les deux comptes).
import type { SupabaseClient } from "@supabase/supabase-js"
import { FILES_BUCKET } from "../lib/supabase"
import { normalizeSummary } from "../lib/summaryMarkdown"
import type { Call, CallInput, Category, DataStore, DocumentInput, DocumentItem, Note } from "./types"

type Row = Record<string, unknown>

const toCall = (r: Row): Call => ({
  id: r.id as string,
  number: r.number as number,
  title: (r.title as string) ?? "",
  date: r.date as string,
  time: (r.time as string) ?? null,
  durationMin: (r.duration_min as number) ?? null,
  type: r.type as Call["type"],
  participants: (r.participants as string[]) ?? [],
  themes: (r.themes as string[]) ?? [],
  videoUrl: (r.video_url as string) ?? null,
  summary: normalizeSummary(r.summary),
  actions: (r.actions as Call["actions"]) ?? [],
  transcript: (r.transcript as Call["transcript"]) ?? null,
  status: r.status as Call["status"],
  hue: (r.hue as number) ?? 222,
  createdBy: (r.created_by as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
})

const fromCall = (c: CallInput): Row => {
  const row: Row = {}
  const map: [keyof CallInput, string][] = [
    ["number", "number"],
    ["title", "title"],
    ["date", "date"],
    ["time", "time"],
    ["durationMin", "duration_min"],
    ["type", "type"],
    ["participants", "participants"],
    ["themes", "themes"],
    ["videoUrl", "video_url"],
    ["summary", "summary"],
    ["actions", "actions"],
    ["transcript", "transcript"],
    ["status", "status"],
    ["hue", "hue"],
    ["createdBy", "created_by"],
  ]
  for (const [k, col] of map) if (k in c) row[col] = c[k] ?? null
  return row
}

const toDoc = (r: Row): DocumentItem => ({
  id: r.id as string,
  title: r.title as string,
  categoryId: (r.category_id as string) ?? null,
  kind: r.kind as DocumentItem["kind"],
  fileName: (r.file_name as string) ?? null,
  size: (r.size as number) ?? null,
  path: (r.path as string) ?? null,
  url: (r.url as string) ?? null,
  source: (r.source as string) ?? null,
  callId: (r.call_id as string) ?? null,
  createdBy: (r.created_by as string) ?? null,
  createdAt: r.created_at as string,
})

const fromDoc = (d: DocumentInput): Row => {
  const row: Row = {}
  const map: [keyof DocumentInput, string][] = [
    ["title", "title"],
    ["categoryId", "category_id"],
    ["kind", "kind"],
    ["fileName", "file_name"],
    ["size", "size"],
    ["path", "path"],
    ["url", "url"],
    ["source", "source"],
    ["callId", "call_id"],
    ["createdBy", "created_by"],
  ]
  for (const [k, col] of map) if (k in d) row[col] = d[k] ?? null
  return row
}

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const signedUrls = new Map<string, { url: string; until: number }>()

const toNote = (r: Row): Note => ({
  id: r.id as string,
  title: (r.title as string) ?? "",
  blocks: (r.blocks as Note["blocks"]) ?? [],
  pinned: !!r.pinned,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
})

export function createSupabaseStore(sb: SupabaseClient, currentMember: () => string | null): DataStore {
  const store: DataStore = {
    mode: "supabase",

    async listCalls() {
      return must(await sb.from("calls").select("*").order("date", { ascending: false })).map(toCall)
    },

    async createCall(input) {
      const calls = await store.listCalls()
      const row = fromCall({
        ...input,
        number: input.number ?? Math.max(0, ...calls.map((c) => c.number)) + 1,
        createdBy: currentMember(),
      })
      return toCall(must(await sb.from("calls").insert(row).select().single()))
    },

    async updateCall(id, patch) {
      return toCall(must(await sb.from("calls").update(fromCall(patch)).eq("id", id).select().single()))
    },

    async deleteCall(id) {
      const { data } = await sb.from("calls").select("transcript").eq("id", id).single()
      const path = (data?.transcript as { path?: string } | null)?.path
      if (path) await sb.storage.from(FILES_BUCKET).remove([path])
      must(await sb.from("calls").delete().eq("id", id))
    },

    async uploadTranscript(callId, file, name) {
      const folder = `transcripts/${callId}`
      const path = `${folder}/${Date.now()}-${safeName(name)}`
      const { data: previous } = await sb.storage.from(FILES_BUCKET).list(folder)
      must(await sb.storage.from(FILES_BUCKET).upload(path, file, { contentType: "text/plain; charset=utf-8" }))
      // Une seule transcription par appel : l'ancienne est supprimée quand on la remplace
      const stale = (previous ?? []).map((o) => `${folder}/${o.name}`).filter((p) => p !== path)
      if (stale.length) await sb.storage.from(FILES_BUCKET).remove(stale)
      return { name, size: file.size, path }
    },

    async readTranscript(call) {
      if (!call.transcript?.path) return ""
      const blob = must(await sb.storage.from(FILES_BUCKET).download(call.transcript.path))
      return blob.text()
    },

    async listCategories() {
      return must(await sb.from("categories").select("*").order("position")) as Category[]
    },

    async createCategory(input) {
      return must(await sb.from("categories").insert(input).select().single()) as Category
    },

    async updateCategory(id, patch) {
      const rest: Partial<Category> = { ...patch }
      delete rest.id
      return must(await sb.from("categories").update(rest).eq("id", id).select().single()) as Category
    },

    async deleteCategory(id) {
      must(await sb.from("categories").delete().eq("id", id))
    },

    async listDocuments() {
      return must(await sb.from("documents").select("*").order("created_at", { ascending: false })).map(toDoc)
    },

    async createDocument(input, file) {
      const id = crypto.randomUUID()
      let path: string | null = null
      if (file) {
        path = `documents/${id}/${safeName(input.fileName ?? "fichier")}`
        must(await sb.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || undefined }))
      }
      const row = fromDoc({ ...input, path, size: file?.size ?? input.size ?? null, createdBy: currentMember() })
      return toDoc(must(await sb.from("documents").insert({ ...row, id }).select().single()))
    },

    async updateDocument(id, patch) {
      return toDoc(must(await sb.from("documents").update(fromDoc(patch)).eq("id", id).select().single()))
    },

    async deleteDocument(doc) {
      if (doc.path) await sb.storage.from(FILES_BUCKET).remove([doc.path])
      must(await sb.from("documents").delete().eq("id", doc.id))
    },

    async getFileUrl(doc) {
      if (doc.kind === "link") return doc.url ?? null
      if (!doc.path) return null
      // Adresse signée gardée 25 min (elle en vaut 30) : rouvrir un document ne redemande rien au serveur
      const cached = signedUrls.get(doc.path)
      if (cached && cached.until > Date.now()) return cached.url
      const { data } = await sb.storage.from(FILES_BUCKET).createSignedUrl(doc.path, 60 * 30)
      if (data?.signedUrl) signedUrls.set(doc.path, { url: data.signedUrl, until: Date.now() + 25 * 60_000 })
      return data?.signedUrl ?? null
    },

    async listNotes() {
      // Les règles de la base ne renvoient que les notes du compte connecté
      return must(await sb.from("notes").select("*").order("updated_at", { ascending: false })).map(toNote)
    },

    async createNote(input) {
      return toNote(must(await sb.from("notes").insert(input).select().single()))
    },

    async updateNote(id, patch) {
      return toNote(must(await sb.from("notes").update(patch).eq("id", id).select().single()))
    },

    async deleteNote(id) {
      must(await sb.from("notes").delete().eq("id", id))
    },

    subscribe(onChange) {
      const channel = sb
        .channel("workspace-ofm")
        .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, onChange)
        .subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },
  }
  return store
}
