import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function createValidLocalDate(
  year: number,
  month: number,
  day: number,
): Date | null {
  const dateObj = new Date(year, month - 1, day);

  const isValid =
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day;

  return isValid ? dateObj : null;
}

export function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;

  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : new Date(date);
  }

  const trimmedDate = date.trim();
  if (!trimmedDate) return null;

  // DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedDate);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);

    return createValidLocalDate(year, month, day);
  }

  // YYYY-MM-DD
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDate);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const month = Number(isoDateOnly[2]);
    const day = Number(isoDateOnly[3]);

    return createValidLocalDate(year, month, day);
  }

  // Full ISO timestamp, e.g. 2024-05-10T14:30:00.000Z
  const isoTimestamp =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      trimmedDate,
    );

  if (isoTimestamp) {
    const parsedDate = new Date(trimmedDate);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

/**
 * Formats a date to DD/MM/YYYY.
 */
export function formatDate(
  date: string | Date | null | undefined,
  fallback = "N/A",
): string {
  const d = parseDate(date);
  if (!d) return fallback;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formats for <input type="text" /> or display.
 */
export function formatDateForInput(
  date: string | Date | null | undefined,
): string {
  return formatDate(date, "");
}

/**
 * Returns current local date as DD/MM/YYYY.
 */
export function getLocalDateValue(): string {
  return formatDate(new Date());
}

/**
 * Converts DD/MM/YYYY, YYYY-MM-DD, Date object, or full ISO timestamp
 * to YYYY-MM-DD for API consumption.
 */
export function formatDateForApi(
  date: string | Date | null | undefined,
): string | null {
  const d = parseDate(date);
  if (!d) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
