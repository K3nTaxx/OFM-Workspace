// Outils communs aux scripts : client Supabase « admin » (clé secrète de .env.local) et enregistrement d'un appel
// (résumé collé + transcription .txt) dans la base, exactement comme le fait le site.
import { createClient } from "@supabase/supabase-js"
import { THUMB_HUES } from "../src/data/catalog.ts"
import { parseSummaryMarkdown } from "../src/lib/summaryMarkdown.ts"

export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    console.error("Il manque VITE_SUPABASE_URL ou SUPABASE_SECRET_KEY dans .env.local")
    process.exit(1)
  }
  return createClient(url, secret, { auth: { persistSession: false } })
}

export const pad = (n) => String(n).padStart(2, "0")
export const transcriptName = (n) => `Appel-${pad(n)}-transcription.txt`

/** Remplace la transcription d'un appel (une seule par appel, l'ancienne est supprimée). */
async function uploadTranscript(admin, call, text) {
  const body = Buffer.from(text, "utf8")
  const name = transcriptName(call.number)
  const folder = `transcripts/${call.id}`
  const path = `${folder}/${Date.now()}-${name}`
  const { data: previous } = await admin.storage.from("files").list(folder)
  const up = await admin.storage.from("files").upload(path, body, { contentType: "text/plain; charset=utf-8" })
  if (up.error) throw new Error(`transcription : ${up.error.message}`)
  const stale = (previous ?? []).map((o) => `${folder}/${o.name}`).filter((p) => p !== path)
  if (stale.length) await admin.storage.from("files").remove(stale)
  return { name, size: body.length, path }
}

/**
 * Crée l'appel n° `number` à partir d'un résumé Markdown (format du skill resume-appel-ofm) et d'une transcription,
 * ou met à jour `existing` (actions déjà cochées conservées). Renvoie la ligne enregistrée.
 */
export async function saveCall(admin, { number, markdown, transcript, existing }) {
  const { summary, actions, info } = parseSummaryMarkdown(markdown)
  const fields = {
    summary,
    status: "ready",
    ...(info.title && { title: info.title }),
    ...(info.date && { date: info.date }),
    ...(info.time && { time: info.time }),
    ...(info.durationMin && { duration_min: info.durationMin }),
    ...(info.type && { type: info.type }),
    ...(info.participants?.length && { participants: info.participants }),
    ...(info.themes?.length && { themes: info.themes }),
  }

  let row
  if (existing) {
    const kept = actions.map((a) => {
      const old = (existing.actions ?? []).find((o) => o.text === a.text)
      return old ? { ...a, id: old.id, done: old.done || a.done } : a
    })
    const res = await admin
      .from("calls")
      .update({ ...fields, ...(actions.length && { actions: kept }) })
      .eq("id", existing.id)
      .select()
      .single()
    if (res.error) throw new Error(res.error.message)
    row = res.data
  } else {
    const res = await admin
      .from("calls")
      .insert({
        number,
        title: "",
        date: new Date().toISOString().slice(0, 10),
        type: "mentorat",
        ...fields,
        actions,
        hue: THUMB_HUES[(number - 1) % THUMB_HUES.length],
        created_by: "quentin",
      })
      .select()
      .single()
    if (res.error) throw new Error(res.error.message)
    row = res.data
  }

  if (transcript?.trim()) {
    const file = await uploadTranscript(admin, row, transcript)
    const res = await admin.from("calls").update({ transcript: file }).eq("id", row.id).select().single()
    if (res.error) throw new Error(res.error.message)
    row = res.data
  }
  return row
}
