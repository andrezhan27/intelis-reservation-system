import type { ManagementBooking } from "@/lib/manageBooking";

export type ManageBookingUpdate = {
  date: string;
  time: string;
  party_size: number;
  special_requests: string;
};

export type ManageBookingChanges = Partial<ManageBookingUpdate>;

export type ManageBookingValidation =
  | { ok: true; proposed: ManageBookingUpdate; changes: ManageBookingChanges }
  | { ok: false; errors: Record<string, string> };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const allowedKeys = new Set(["date", "time", "party_size", "special_requests"]);

export function validateManageBookingUpdate(
  input: unknown,
  booking: ManagementBooking,
  minPartySize: number,
  maxPartySize: number | null
): ManageBookingValidation {
  if (!isPlainObject(input)) {
    return { ok: false, errors: { form: "Invalid request." } };
  }

  const errors: Record<string, string> = {};

  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    errors.form = "Invalid request.";
  }

  const date = readString(input.date, booking.date);
  const time = readString(input.time, booking.time);
  const specialRequests = readString(
    input.special_requests,
    booking.special_requests
  );
  const partySize = readPartySize(input.party_size, booking.party_size);

  if (!datePattern.test(date) || !isRealDate(date)) {
    errors.date = "Invalid date.";
  }

  if (!timePattern.test(time)) {
    errors.time = "Invalid time.";
  }

  if (!Number.isInteger(partySize) || partySize < minPartySize) {
    errors.party_size = `Party size must be at least ${minPartySize}.`;
  } else if (maxPartySize !== null && partySize > maxPartySize) {
    errors.party_size = `Party size cannot exceed ${maxPartySize}.`;
  }

  if (specialRequests.length > 2000) {
    errors.special_requests = "Special requests must be 2000 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const proposed = {
    date,
    time,
    party_size: partySize,
    special_requests: specialRequests
  };
  const changes: ManageBookingChanges = {};

  if (date !== booking.date) changes.date = date;
  if (time !== booking.time) changes.time = time;
  if (partySize !== booking.party_size) changes.party_size = partySize;
  if (specialRequests !== booking.special_requests) {
    changes.special_requests = specialRequests;
  }

  return { ok: true, proposed, changes };
}

export function createChangeSummary(changes: ManageBookingChanges) {
  const summary: string[] = [];

  if (changes.date !== undefined) summary.push(`date: ${changes.date}`);
  if (changes.time !== undefined) summary.push(`time: ${changes.time}`);
  if (changes.party_size !== undefined) {
    summary.push(`party size: ${changes.party_size}`);
  }
  if (changes.special_requests !== undefined) {
    summary.push("special requests updated");
  }

  return summary;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string) {
  if (value === undefined) return fallback;
  return typeof value === "string" ? value.trim() : "";
}

function readPartySize(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  return typeof value === "number" ? value : Number.NaN;
}

function isRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
