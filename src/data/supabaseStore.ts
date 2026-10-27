// Mode connecté : Supabase (base Postgres + fichiers + temps réel entre les deux comptes).
import type { SupabaseClient } from "@supabase/supabase-js"
import { FILES_BUCKET } from "../lib/supabase"
import type { Call, CallInput, Category, DataStore, DocumentInput, DocumentItem } from "./types"

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
  summary: (r.summary as Call["summary"]) ?? null,
  actions: (r.actions as Call["actions"]) ?? [],
  transcript: (r.transcript as Call["transcript"]) ?? null,
  status: r.status as Call["status"],
  statusDetail: (r.status_detail as string) ?? null,
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
    ["statusDetail", "status_detail"],
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
      const path = `transcripts/${callId}/${Date.now()}-${safeName(name)}`
      must(await sb.storage.from(FILES_BUCKET).upload(path, file, { contentType: "text/plain; charset=utf-8" }))
      return { name, size: file.size, path }
    },

    async readTranscript(call) {
      if (!call.transcript?.path) return ""
      const blob = must(await sb.storage.from(FILES_BUCKET).download(call.transcript.path))
      return blob.text()
    },

    async analyzeCall(callId) {
      await store.updateCall(callId, { status: "analyzing", statusDetail: null })
      const { data } = await sb.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch("/api/analyze-call", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ callId }),
      }).catch(() => null)
      if (!res || (res.status !== 202 && !res.ok)) {
        await store.updateCall(callId, {
          status: "error",
          statusDetail: "Le service d'analyse IA ne répond pas (il fonctionne une fois le site publié sur Netlify).",
        })
      }
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
      const { data } = await sb.storage.from(FILES_BUCKET).createSignedUrl(doc.path, 60 * 30)
      return data?.signedUrl ?? null
    },

    subscribe(onChange) {
      const channel = sb
        .channel("workspace-ofm")
        .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
        .subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },
  }
  return store
}
