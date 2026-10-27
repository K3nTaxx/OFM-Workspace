import { motion } from "framer-motion"
import { ArrowSquareOutIcon, CopyIcon, TrashIcon } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import type { Call } from "../data/types"
import { useWorkspace } from "../data/workspace"
import { duration, relativeDay } from "../lib/format"
import { useUI } from "../ui/UIProvider"
import { CallThumbnail } from "./CallThumbnail"
import { TypeTag } from "./Controls"

export function useCallActions() {
  const navigate = useNavigate()
  const { store, refresh } = useWorkspace()
  const { toast, confirm } = useUI()

  const remove = async (call: Call) => {
    const ok = await confirm({
      title: `Supprimer « Appel #${call.number} » ?`,
      message: "Le résumé, les actions et la transcription seront supprimés. Cette action est définitive.",
      confirmLabel: "Supprimer",
      danger: true,
    })
    if (!ok) return
    await store.deleteCall(call.id)
    await refresh()
    toast(`Appel #${call.number} supprimé`)
  }

  const menuFor = (call: Call) => [
    { label: "Ouvrir", icon: <ArrowSquareOutIcon size={15} />, onSelect: () => navigate(`/appels/${call.id}`) },
    {
      label: "Copier le lien",
      icon: <CopyIcon size={15} />,
      onSelect: () => {
        navigator.clipboard.writeText(`${window.location.origin}/appels/${call.id}`)
        toast("Lien copié")
      },
    },
    { separator: true },
    { label: "Supprimer…", icon: <TrashIcon size={15} />, danger: true, onSelect: () => remove(call) },
  ]

  return { remove, menuFor }
}

export function CallCard({ call }: { call: Call }) {
  const navigate = useNavigate()
  const { openMenu } = useUI()
  const { menuFor } = useCallActions()
  return (
    <motion.button
      type="button"
      className="call-card"
      onClick={() => navigate(`/appels/${call.id}`)}
      onContextMenu={(e) => {
        e.preventDefault()
        openMenu(e, menuFor(call))
      }}
      whileTap={{ scale: 0.985 }}
    >
      <CallThumbnail call={call} shared />
      <div className="call-card-body">
        <div className="call-card-title">{call.title || "Sans titre"}</div>
        <div className="call-card-meta">
          <TypeTag type={call.type} />
          <span className="tnum">{relativeDay(call.date)}</span>
          {call.durationMin ? <span className="tnum">· {duration(call.durationMin)}</span> : null}
        </div>
      </div>
    </motion.button>
  )
}
