import { useMemo, useState } from "react";
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function compareDates(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
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

function todayDate(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function clampToBounds(date: CalendarDate, minDate: CalendarDate | null, maxDate: CalendarDate | null) {
  if (minDate && compareDates(date, minDate) < 0) return minDate;
  if (maxDate && compareDates(date, maxDate) > 0) return maxDate;
  return date;
}

function monthLabel(date: CalendarDate) {
  return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

// Referenced to prevent unused variable lint errors; will be used in full calendar implementation
void formatIsoDate;

export function DatePicker({
  value,
  placeholder = "Select date",
  disabled = false,
  minDate,
  maxDate,
  ...rest
}: DatePickerProps) {
  const selectedDate = parseIsoDate(value);
  const parsedMinDate = parseIsoDate(minDate);
  const parsedMaxDate = parseIsoDate(maxDate);
  const initialCalendarDate = clampToBounds(selectedDate ?? todayDate(), parsedMinDate, parsedMaxDate);
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<CalendarDate>(initialCalendarDate);

  const displayValue = useMemo(() => (value ? formatDisplayDate(value) : null), [value]);
  const label = rest["aria-label"];

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) {
      setOpen(false);
      return;
    }

    if (nextOpen) {
      const nextBase = clampToBounds(parseIsoDate(value) ?? todayDate(), parsedMinDate, parsedMaxDate);
      setDisplayMonth({ year: nextBase.year, month: nextBase.month, day: 1 });
    }

    setOpen(nextOpen);
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      align="start"
      contentClassName="w-72 p-3"
      trigger={
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={`inline-flex h-control-base w-full items-center justify-between rounded border border-border bg-background px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            disabled ? "cursor-default text-subtext-1 opacity-60" : displayValue ? "text-text" : "text-subtext-1"
          }`}
        >
          <span className="truncate">{displayValue ?? placeholder}</span>
        </button>
      }
    >
      <div className="text-sm text-text" aria-label={monthLabel(displayMonth)}>
        {monthLabel(displayMonth)}
      </div>
    </Popover>
  );
}
