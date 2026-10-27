import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useAuth } from "../auth/AuthProvider"
import { supabase } from "../lib/supabase"
import { createDemoStore } from "./demoStore"
import { createSupabaseStore } from "./supabaseStore"
import type { Call, Category, DataStore, DocumentItem } from "./types"

interface WorkspaceValue {
  store: DataStore
  /** Modifie un appel à partir de sa toute dernière version (affiché aussitôt, puis enregistré). */
  patchCall: (id: string, change: (call: Call) => Partial<Call>) => Promise<void>
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
  const latestCalls = useRef<Call[]>([])
  const lastRefresh = useRef(0)

  const refresh = useCallback(async () => {
    // Si plusieurs rafraîchissements se croisent (sauvegarde, temps réel, autre onglet), seul le dernier lancé compte
    const id = ++lastRefresh.current
    try {
      const [c, cat, d] = await Promise.all([store.listCalls(), store.listCategories(), store.listDocuments()])
      if (id !== lastRefresh.current) return
      latestCalls.current = c.sort((a, b) => (a.date === b.date ? b.number - a.number : b.date.localeCompare(a.date)))
      setCalls(latestCalls.current)
      setCategories(cat)
      setDocuments(d.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    } catch (e) {
      // Base injoignable (réseau, session expirée) : on garde ce qui est affiché plutôt que de bloquer le logiciel
      console.error("Chargement des données impossible", e)
    } finally {
      if (id === lastRefresh.current) setLoaded(true)
    }
  }, [store])

  const patchCall = useCallback<WorkspaceValue["patchCall"]>(
    async (id, change) => {
      const current = latestCalls.current.find((c) => c.id === id)
      if (!current) return
      const patch = change(current)
      // Deux cases cochées très vite : la seconde part de la version où la première est déjà cochée
      latestCalls.current = latestCalls.current.map((c) => (c.id === id ? { ...c, ...patch } : c))
      setCalls(latestCalls.current)
      try {
        await store.updateCall(id, patch)
      } finally {
        await refresh()
      }
    },
    [store, refresh],
  )

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
    () => ({ store, patchCall, calls, categories, documents, loaded, refresh }),
    [store, patchCall, calls, categories, documents, loaded, refresh],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace hors WorkspaceProvider")
  return ctx
}
