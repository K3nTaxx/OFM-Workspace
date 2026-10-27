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
}: {
  calls: Call[]
  onOpen: (call: Call) => void
  onCreate: (date: string) => void
}) {
  const [month, setMonth] = useState(() => new Date())
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
      <div className="cal-grid" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
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
      </div>
    </div>
  )
}

export function MiniCalendar({ calls, onSelectDay }: { calls: Call[]; onSelectDay: (date: Date) => void }) {
  const [month, setMonth] = useState(() => new Date())
  const days = useMonthGrid(month)
  return (
    <div className="minical">
      <MonthNav month={month} setMonth={setMonth} compact />
      <div className="minical-grid">
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
      </div>
    </div>
  )
}
