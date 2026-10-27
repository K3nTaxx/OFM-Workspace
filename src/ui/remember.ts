import { useState } from "react"

// Réglages de vue (recherche, filtre, grille ou liste) gardés quand on quitte une page puis qu'on y revient
const memory = new Map<string, unknown>()

export function useRemembered<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial))
  const set = (v: T) => {
    memory.set(key, v)
    setValue(v)
  }
  return [value, set] as const
}
