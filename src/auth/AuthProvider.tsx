import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { TEAM, type TeamMemberId } from "../data/team"
import type { Session } from "../data/types"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

interface AuthValue {
  session: Session | null
  ready: boolean
  signIn: (memberId: TeamMemberId, password: string) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const DEMO_KEY = "ofm.session"

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

const memberFromEmail = (email: string | undefined) => TEAM.find((m) => m.email === email?.toLowerCase())

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw) setSession(JSON.parse(raw) as Session)
      setReady(true)
      return
    }
    const apply = (user: { id: string; email?: string } | null | undefined) => {
      const m = memberFromEmail(user?.email)
      setSession(user && m ? { userId: user.id, memberId: m.id, name: m.name, email: m.email } : null)
    }
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => apply(s?.user))
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (memberId: TeamMemberId, password: string) => {
    const member = TEAM.find((m) => m.id === memberId)
    if (!member) return false
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: member.email, password })
      return !error
    }
    if ((await sha256(password)) !== member.passwordSha256) return false
    const s: Session = { userId: member.id, memberId: member.id, name: member.name, email: member.email }
    localStorage.setItem(DEMO_KEY, JSON.stringify(s))
    setSession(s)
    return true
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem(DEMO_KEY)
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, ready, signIn, signOut }), [session, ready, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth hors AuthProvider")
  return ctx
}

export const DEMO_MODE = !isSupabaseConfigured
