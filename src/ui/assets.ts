// Images affichées dès l'ouverture (les logos) : on attend qu'elles soient prêtes pour que tout l'écran apparaisse
// d'un seul coup, au lieu d'éléments qui arrivent un par un. Jamais plus de 1,5 s d'attente.
const load = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image()
    img.src = src
    img.decode().then(resolve, resolve)
  })

export const brandReady: Promise<unknown> = Promise.race([
  Promise.all(["/logo-mark.png", "/logo.png"].map(load)),
  new Promise((resolve) => setTimeout(resolve, 1500)),
])
