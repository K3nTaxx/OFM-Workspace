import { motion } from "framer-motion"
import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { callType, themeColor } from "../data/catalog"
import type { CallType, TagColor } from "../data/types"

/**
 * Position de l'option active dans son conteneur, pour le fond ou le trait qui glisse dessous. Mesurée par rapport au
 * conteneur : si tout le contrôle se décale (titre plus long, etc.), rien ne glisse ; seul un changement d'option anime.
 */
export function useIndicator(container: RefObject<HTMLElement | null>, selector: string, active: unknown) {
  const [box, setBox] = useState<{ x: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const measure = () => {
      const target = el.querySelector<HTMLElement>(selector)
      const next = target ? { x: target.offsetLeft, width: target.offsetWidth } : null
      setBox((prev) => (prev && next && prev.x === next.x && prev.width === next.width ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => ro.disconnect()
  }, [container, selector, active])
  return box
}

export const SLIDE = { type: "spring", stiffness: 520, damping: 42 } as const

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const thumb = useIndicator(ref, '[aria-pressed="true"]', value)
  return (
    <div ref={ref} className="segmented" role="group">
      {thumb && <motion.span className="segmented-thumb" initial={false} animate={{ x: thumb.x, width: thumb.width }} transition={SLIDE} />}
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tag({ color = "gray", children, onRemove }: { color?: TagColor; children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="tag" data-color={color}>
      {children}
      {onRemove && (
        <button type="button" className="tag-x" onClick={onRemove} aria-label="Retirer">
          <XIcon size={10} weight="bold" />
        </button>
      )}
    </span>
  )
}

export const TypeTag = ({ type }: { type: CallType }) => {
  const t = callType(type)
  return <Tag color={t.color}>{t.label}</Tag>
}

export const ThemeTag = ({ label, onRemove }: { label: string; onRemove?: () => void }) => (
  <Tag color={themeColor(label)} onRemove={onRemove}>
    {label}
  </Tag>
)

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="checkbox"
      data-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      {checked && <CheckIcon size={11} weight="bold" />}
    </button>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} className="switch" data-on={on} onClick={() => onChange(!on)} />
}

export function Avatar({ name, size }: { name: string; size?: number }) {
  const id = name.toLowerCase()
  return (
    <span
      className="avatar"
      data-user={id === "quentin" || id === "logan" ? id : undefined}
      style={size ? { width: size, height: size, fontSize: size * 0.42 } : undefined}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}
