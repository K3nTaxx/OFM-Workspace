import { motion } from "framer-motion"
import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useId, type ReactNode } from "react"
import { callType, themeColor } from "../data/catalog"
import type { CallType, TagColor } from "../data/types"

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
}) {
  const id = useId()
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="segmented-thumb"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
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
