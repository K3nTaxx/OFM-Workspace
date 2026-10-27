import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useAuth } from "../auth/AuthProvider"
import { supabase } from "../lib/supabase"
import { createDemoStore } from "./demoStore"
import { createSupabaseStore } from "./supabaseStore"
import type { Call, Category, DataStore, DocumentItem } from "./types"

interface WorkspaceValue {
  store: DataStore
  calls: Call[]
  categories: Category[]
  documents: DocumentItem[]
  loaded: boolean
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const memberRef = useRef<string | null>(session?.memberId ?? null)
  memberRef.current = session?.memberId ?? null

  const store = useMemo(
    () => (supabase ? createSupabaseStore(supabase, () => memberRef.current) : createDemoStore(() => memberRef.current)),
    [],
  )

  const [calls, setCalls] = useState<Call[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [c, cat, d] = await Promise.all([store.listCalls(), store.listCategories(), store.listDocuments()])
    setCalls(c.sort((a, b) => (a.date === b.date ? b.number - a.number : b.date.localeCompare(a.date))))
    setCategories(cat)
    setDocuments(d.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setLoaded(true)
  }, [store])

  useEffect(() => {
    refresh()
    let timer: number | undefined
    const unsubscribe = store.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, 60)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [store, refresh])

  const value = useMemo(
    () => ({ store, calls, categories, documents, loaded, refresh }),
    [store, calls, categories, documents, loaded, refresh],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace hors WorkspaceProvider")
  return ctx
}
