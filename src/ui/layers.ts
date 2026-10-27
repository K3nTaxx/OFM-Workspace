import { useEffect, useRef } from "react"

// Couches ouvertes par-dessus le logiciel (feuille, aperçu, palette, menu, confirmation), de la plus ancienne à la
// plus récente. Échap ne ferme que celle du dessus, et les raccourcis globaux se taisent tant qu'il y en a une.
const stack: symbol[] = []

export const anyLayerOpen = () => stack.length > 0

/** Vrai si la touche part d'un endroit où l'on écrit (champ, zone de texte, lecteur vidéo ou audio). */
export const isTyping = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("input, textarea, select, [contenteditable], video, audio")

/**
 * Déclare une couche tant que `open` est vrai : Échap (s'il n'a pas déjà servi à un champ) appelle `onEscape` si
 * elle est au-dessus des autres. À la fermeture, le focus revient là où il était avant l'ouverture.
 */
export function useLayer(open: boolean, onEscape?: () => void) {
  const id = useRef(Symbol("couche")).current
  const escape = useRef(onEscape)
  escape.current = onEscape

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    stack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || stack.at(-1) !== id) return
      e.preventDefault()
      escape.current?.()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      stack.splice(stack.indexOf(id), 1)
      if (previous?.isConnected && !stack.length) previous.focus({ preventScroll: true })
    }
  }, [open, id])
}
