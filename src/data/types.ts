export type TagColor = "gray" | "blue" | "purple" | "pink" | "red" | "orange" | "yellow" | "green" | "brown"

export type CallType = "mentorat" | "decouverte" | "questions" | "interne"

export type CallStatus = "ready" | "planned"

export interface ActionItem {
  id: string
  text: string
  owner?: string
  done: boolean
}

/** Résumé collé, tel quel (Markdown). Le titre « # … » et le bloc « ## Infos » remplissent la fiche et n'y sont pas. */
export interface CallSummary {
  markdown: string
}

export interface TranscriptFile {
  name: string
  size: number
  path: string
}

export interface Call {
  id: string
  number: number
  title: string
  date: string // AAAA-MM-JJ
  time?: string | null // HH:mm
  durationMin?: number | null
  type: CallType
  participants: string[]
  themes: string[]
  videoUrl?: string | null
  summary?: CallSummary | null
  actions: ActionItem[]
  transcript?: TranscriptFile | null
  status: CallStatus
  hue: number
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export type CallInput = Partial<Omit<Call, "id" | "createdAt" | "updatedAt">>

export interface Category {
  id: string
  name: string
  color: TagColor
  position: number
}

export type DocumentKind = "pdf" | "image" | "video" | "link" | "text" | "other"

export interface DocumentItem {
  id: string
  title: string
  categoryId: string | null
  kind: DocumentKind
  fileName?: string | null
  size?: number | null
  path?: string | null
  url?: string | null
  source?: string | null
  callId?: string | null
  createdBy?: string | null
  createdAt: string
}

export type DocumentInput = Partial<Omit<DocumentItem, "id" | "createdAt">>

export interface Session {
  userId: string
  memberId: "quentin" | "logan"
  name: string
  email: string
}

export interface DataStore {
  readonly mode: "demo" | "supabase"
  listCalls(): Promise<Call[]>
  createCall(input: CallInput): Promise<Call>
  updateCall(id: string, patch: CallInput): Promise<Call>
  deleteCall(id: string): Promise<void>
  uploadTranscript(callId: string, file: Blob, name: string): Promise<TranscriptFile>
  readTranscript(call: Call): Promise<string>

  listCategories(): Promise<Category[]>
  createCategory(input: Omit<Category, "id">): Promise<Category>
  updateCategory(id: string, patch: Partial<Category>): Promise<Category>
  deleteCategory(id: string): Promise<void>

  listDocuments(): Promise<DocumentItem[]>
  createDocument(input: DocumentInput, file?: File | Blob | null): Promise<DocumentItem>
  updateDocument(id: string, patch: DocumentInput): Promise<DocumentItem>
  deleteDocument(doc: DocumentItem): Promise<void>
  getFileUrl(doc: DocumentItem): Promise<string | null>

  /** Prévient quand quelqu'un (soi-même ou l'autre compte) modifie les données. */
  subscribe(onChange: () => void): () => void
}
