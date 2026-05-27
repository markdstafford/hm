import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "../overlays/Popover";

export type DatePickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  "aria-label": string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
};

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type CalendarCell = {
  key: string;
  date: CalendarDate | null;
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function compareDates(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function sameDate(a: CalendarDate | null, b: CalendarDate | null) {
  return Boolean(a && b && compareDates(a, b) === 0);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isValidDateParts(year: number, month: number, day: number) {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !isValidDateParts(year, month, day)) return null;
  return { year, month, day };
}

function formatIsoDate(date: CalendarDate) {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

function formatDisplayDate(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  return `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

function formatLongDate(date: CalendarDate) {
  return `${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`;
}

function todayDate(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function clampToBounds(date: CalendarDate, minDate: CalendarDate | null, maxDate: CalendarDate | null) {
  if (minDate && compareDates(date, minDate) < 0) return minDate;
  if (maxDate && compareDates(date, maxDate) > 0) return maxDate;
  return date;
}

function isDateDisabled(date: CalendarDate, minDate: CalendarDate | null, maxDate: CalendarDate | null) {
  return Boolean((minDate && compareDates(date, minDate) < 0) || (maxDate && compareDates(date, maxDate) > 0));
}

function monthLabel(date: CalendarDate) {
  return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

function startOfMonth(date: CalendarDate): CalendarDate {
  return { year: date.year, month: date.month, day: 1 };
}

function addMonths(date: CalendarDate, delta: number): CalendarDate {
  const nativeDate = new Date(date.year, date.month - 1 + delta, 1);
  return { year: nativeDate.getFullYear(), month: nativeDate.getMonth() + 1, day: 1 };
}

function addDays(date: CalendarDate, delta: number): CalendarDate {
  const nativeDate = new Date(date.year, date.month - 1, date.day + delta);
  return { year: nativeDate.getFullYear(), month: nativeDate.getMonth() + 1, day: nativeDate.getDate() };
}

function buildCalendarCells(displayMonth: CalendarDate): CalendarCell[] {
  const firstWeekday = new Date(displayMonth.year, displayMonth.month - 1, 1).getDay();
  const totalDays = daysInMonth(displayMonth.year, displayMonth.month);
  const cells: CalendarCell[] = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push({ key: `blank-start-${index}`, date: null });
  for (let day = 1; day <= totalDays; day += 1) cells.push({ key: formatIsoDate({ year: displayMonth.year, month: displayMonth.month, day }), date: { year: displayMonth.year, month: displayMonth.month, day } });
  while (cells.length % 7 !== 0) cells.push({ key: `blank-end-${cells.length}`, date: null });
  return cells;
}

function dayAccessibleName(date: CalendarDate, selectedDate: CalendarDate | null, today: CalendarDate, unavailable: boolean) {
  const states = [];
  if (sameDate(date, selectedDate)) states.push("selected");
  if (sameDate(date, today)) states.push("today");
  if (unavailable) states.push("unavailable");
  return [formatLongDate(date), ...states].join(", ");
}

export function DatePicker({ value, onChange, placeholder = "Select date", disabled = false, minDate, maxDate, ...rest }: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstFocusableDayRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocusDayRef = useRef(false);
  const selectedDate = parseIsoDate(value);
  const parsedMinDate = parseIsoDate(minDate);
  const parsedMaxDate = parseIsoDate(maxDate);
  const today = todayDate();
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<CalendarDate>(() => startOfMonth(clampToBounds(selectedDate ?? today, parsedMinDate, parsedMaxDate)));
  const [focusedDay, setFocusedDay] = useState<CalendarDate>(() => clampToBounds(selectedDate ?? today, parsedMinDate, parsedMaxDate));
  const displayValue = useMemo(() => (value ? formatDisplayDate(value) : null), [value]);
  const calendarCells = useMemo(() => buildCalendarCells(displayMonth), [displayMonth]);
  const label = rest["aria-label"];

  useEffect(() => {
    if (pendingFocusDayRef.current) {
      pendingFocusDayRef.current = false;
      firstFocusableDayRef.current?.focus();
    }
  });

  function focusTriggerSoon() {
    setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function getOpenBaseDate() {
    return clampToBounds(parseIsoDate(value) ?? todayDate(), parsedMinDate, parsedMaxDate);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) {
      setOpen(false);
      return;
    }
    if (nextOpen) {
      const baseDate = getOpenBaseDate();
      setDisplayMonth(startOfMonth(baseDate));
      setFocusedDay(baseDate);
    }
    setOpen(nextOpen);
  }

  function closeAndFocusTrigger() {
    setOpen(false);
    focusTriggerSoon();
  }

  function selectDate(date: CalendarDate) {
    if (isDateDisabled(date, parsedMinDate, parsedMaxDate)) return;
    onChange(formatIsoDate(date));
    closeAndFocusTrigger();
  }

  function clearDate() {
    onChange(null);
    closeAndFocusTrigger();
  }

  function moveFocusedDay(delta: number) {
    const nextDay = clampToBounds(addDays(focusedDay, delta), parsedMinDate, parsedMaxDate);
    pendingFocusDayRef.current = true;
    setFocusedDay(nextDay);
    setDisplayMonth(startOfMonth(nextDay));
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocusedDay(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocusedDay(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusedDay(-7);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusedDay(7);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectDate(focusedDay);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      align="start"
      contentClassName="w-72 p-3"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        setTimeout(() => firstFocusableDayRef.current?.focus(), 0);
      }}
      trigger={
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          disabled={disabled}
          className={`inline-flex h-control-base w-full items-center justify-between rounded border border-border bg-background px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${disabled ? "cursor-default text-subtext-1 opacity-60" : displayValue ? "text-text" : "text-subtext-1"}`}
        >
          <span className="truncate">{displayValue ?? placeholder}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-2 text-sm text-text">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setDisplayMonth((current) => addMonths(current, -1))} className="inline-flex h-control-base w-control-base items-center justify-center rounded text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">‹</button>
          <div className="font-medium" aria-live="polite">{monthLabel(displayMonth)}</div>
          <button type="button" aria-label="Next month" onClick={() => setDisplayMonth((current) => addMonths(current, 1))} className="inline-flex h-control-base w-control-base items-center justify-center rounded text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">›</button>
        </div>
        <div role="grid" aria-label={monthLabel(displayMonth)} onKeyDown={handleGridKeyDown} className="grid grid-cols-7 gap-1">
          {WEEKDAY_SHORT_NAMES.map((weekday, index) => (
            <div key={`${weekday}-${index}`} role="columnheader" aria-label={WEEKDAY_NAMES[index]} className="flex h-6 items-center justify-center text-xs font-medium text-subtext-1">{weekday}</div>
          ))}
          {calendarCells.map((cell) => {
            if (!cell.date) return <div key={cell.key} role="gridcell" aria-hidden="true" className="h-control-base" />;
            const dayDisabled = isDateDisabled(cell.date, parsedMinDate, parsedMaxDate);
            const isSelected = sameDate(cell.date, selectedDate);
            const isToday = sameDate(cell.date, today);
            const isFocused = sameDate(cell.date, focusedDay);
            const shouldReceiveTab = isFocused && !dayDisabled;
            return (
              <button
                key={cell.key}
                ref={shouldReceiveTab ? firstFocusableDayRef : undefined}
                type="button"
                aria-label={dayAccessibleName(cell.date, selectedDate, today, dayDisabled)}
                aria-selected={isSelected || undefined}
                disabled={dayDisabled}
                tabIndex={shouldReceiveTab ? 0 : -1}
                onFocus={() => setFocusedDay(cell.date!)}
                onClick={() => selectDate(cell.date!)}
                onKeyDown={handleGridKeyDown}
                className={`inline-flex h-control-base items-center justify-center rounded text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isSelected ? "bg-primary text-background" : dayDisabled ? "cursor-default text-subtext-1 opacity-40" : "text-text hover:bg-surface"} ${isToday && !isSelected ? "ring-1 ring-primary" : ""}`}
              >
                {cell.date.day}
              </button>
            );
          })}
        </div>
        {selectedDate && (
          <div className="border-t border-border pt-2">
            <button type="button" aria-label="Clear date" onClick={clearDate} className="inline-flex h-control-base items-center rounded px-2 text-sm text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Clear</button>
          </div>
        )}
      </div>
    </Popover>
  );
}
