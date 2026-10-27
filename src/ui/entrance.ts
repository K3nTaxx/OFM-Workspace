// Arrivée dans le logiciel : la barre latérale, la barre d'outils puis chaque bloc visible apparaissent l'un après
// l'autre, dans l'ordre de lecture (haut → bas, gauche → droite). Les blocs sont trouvés automatiquement : ça
// s'adapte à n'importe quelle page et à n'importe quel contenu.

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"
const MAX_BLOCKS = 36

function visible(el: Element) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

/** Les « blocs » d'une zone : on descend dans les grandes colonnes et les grilles pour animer leurs éléments un par un. */
function blocks(root: Element, out: HTMLElement[], depth = 0) {
  for (const child of root.children) {
    if (!(child instanceof HTMLElement) || !visible(child)) continue
    const r = child.getBoundingClientRect()
    const style = getComputedStyle(child)
    const isGroup = (style.display.includes("grid") || style.display.includes("flex")) && child.children.length > 1
    const tall = r.height > window.innerHeight * 0.34
    if (depth < 5 && child.children.length > 0 && (tall || (isGroup && r.height > 120))) blocks(child, out, depth + 1)
    else out.push(child)
  }
}

const readingOrder = (a: HTMLElement, b: HTMLElement) => {
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left
}

export function playEntrance(app: HTMLElement, kind: "login" | "startup") {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const slow = kind === "login"
  const start = slow ? 160 : 0
  const step = slow ? 26 : 14
  const rise = (el: Element, delay: number, from: string, duration = slow ? 720 : 460) =>
    el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration, delay, easing: EASE, fill: "backwards" })

  // Barre latérale (le logo arrive à part, il vole depuis l'écran de connexion)
  const side = [...app.querySelectorAll(".sidebar-search, .sidebar .nav-group-title, .sidebar .nav-item, .sidebar-foot")].filter(visible)
  side.forEach((el, i) => rise(el, start + i * step, "translateX(-10px)"))

  // Barre d'outils et barre d'état
  app.querySelectorAll(".toolbar").forEach((el) => rise(el, start + 40, "translateY(-6px)"))
  app.querySelectorAll(".statusbar").forEach((el) => rise(el, start + 200, "none"))

  // Contenu de la page
  const content: HTMLElement[] = []
  app.querySelectorAll(".page-scroll, .library-cats, .inspector").forEach((zone) => blocks(zone, content))
  content.sort(readingOrder)
  content.slice(0, MAX_BLOCKS).forEach((el, i) => rise(el, start + 90 + i * (step + 14), "translateY(18px) scale(0.985)"))
  content.slice(MAX_BLOCKS).forEach((el) => rise(el, start + 90 + MAX_BLOCKS * (step + 14), "none"))
}
