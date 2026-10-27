import { motion } from "framer-motion"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { fr } from "date-fns/locale"
import { useMemo, useState } from "react"
import { callType } from "../data/catalog"
import type { Call } from "../data/types"
import { parseDay } from "../lib/format"

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]

function useMonthGrid(month: Date) {
  return useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  )
}

/** Mois affiché + sens du dernier changement (pour faire glisser la grille du bon côté, comme Calendrier sur Mac). */
function useMonth(initial?: Date) {
  const [state, setState] = useState(() => ({ month: initial ?? new Date(), dir: 0 }))
  const go = (d: Date) => setState((s) => ({ month: d, dir: d > s.month ? 1 : d < s.month ? -1 : 0 }))
  return [state.month, go, state.dir] as const
}

const slide = (dir: number, distance: number) => ({
  initial: dir === 0 ? false : ({ opacity: 0, x: dir * distance } as const),
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const },
})

const monthTitle = (d: Date) => {
  const s = format(d, "MMMM yyyy", { locale: fr })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function MonthNav({ month, setMonth, compact }: { month: Date; setMonth: (d: Date) => void; compact?: boolean }) {
  return (
    <div className={compact ? "minical-head" : "cal-head"}>
      <span className={compact ? "minical-title" : "cal-title"}>{monthTitle(month)}</span>
      <div className="cal-nav">
        <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent">
          <CaretLeftIcon size={13} weight="bold" />
        </button>
        {!compact && (
          <button type="button" className="btn btn--sm" onClick={() => setMonth(new Date())}>
            Aujourd'hui
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant">
          <CaretRightIcon size={13} weight="bold" />
        </button>
      </div>
    </div>
  )
}

export function MonthCalendar({
  calls,
  onOpen,
  onCreate,
  initialMonth,
}: {
  calls: Call[]
  onOpen: (call: Call) => void
  onCreate: (date: string) => void
  /** Mois affiché à l'ouverture (clic sur un jour du mini-calendrier de l'accueil). */
  initialMonth?: Date
}) {
  const [month, setMonth, dir] = useMonth(initialMonth)
  const days = useMonthGrid(month)
  const weeks = days.length / 7

  return (
    <div className="cal">
      <MonthNav month={month} setMonth={setMonth} />
      <div className="cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <motion.div
        key={format(month, "yyyy-MM")}
        className="cal-grid"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        {...slide(dir, 28)}
      >
        {days.map((day) => {
          const dayCalls = calls.filter((c) => isSameDay(parseDay(c.date), day))
          return (
            <div
              key={day.toISOString()}
              className="cal-cell"
              data-outside={!isSameMonth(day, month)}
              data-today={isToday(day)}
              onDoubleClick={() => onCreate(format(day, "yyyy-MM-dd"))}
            >
              <span className="cal-day tnum">{format(day, "d")}</span>
              <div className="cal-events">
                {dayCalls.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cal-event"
                    data-color={callType(c.type).color}
                    data-planned={c.status === "planned"}
                    onClick={() => onOpen(c)}
                  >
                    {c.time && <span className="cal-event-time tnum">{c.time}</span>}
                    <span className="cal-event-title">
                      #{c.number} {c.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

export function MiniCalendar({ calls, onSelectDay }: { calls: Call[]; onSelectDay: (date: Date) => void }) {
  const [month, setMonth, dir] = useMonth()
  const days = useMonthGrid(month)
  return (
    <div className="minical">
      <MonthNav month={month} setMonth={setMonth} compact />
      <motion.div key={format(month, "yyyy-MM")} className="minical-grid" {...slide(dir, 14)}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="minical-wd">
            {d.charAt(0).toUpperCase()}
          </span>
        ))}
        {days.map((day) => {
          const has = calls.filter((c) => isSameDay(parseDay(c.date), day))
          return (
            <button
              key={day.toISOString()}
              type="button"
              className="minical-day tnum"
              data-outside={!isSameMonth(day, month)}
              data-today={isToday(day)}
              onClick={() => onSelectDay(day)}
            >
              {format(day, "d")}
              {has.length > 0 && (
                <span className="minical-dots">
                  {has.slice(0, 3).map((c) => (
                    <i key={c.id} data-color={callType(c.type).color} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>
    </div>
  )
}
