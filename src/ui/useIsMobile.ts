import { useSyncExternalStore } from "react"

/** Téléphone (et petite tablette en portrait) : la mise en page « application mobile » prend le relais. */
export const MOBILE_QUERY = "(max-width: 900px)"

const media = typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY) : null

export const isMobile = () => !!media?.matches

export function useIsMobile() {
  return useSyncExternalStore(
    (change) => {
      media?.addEventListener("change", change)
      return () => media?.removeEventListener("change", change)
    },
    isMobile,
    () => false,
  )
}
