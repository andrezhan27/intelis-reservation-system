import type { RestaurantSettings } from "@/lib/types";

const slotIntervalMinutes = 30;

export type TimeSlotOption = {
  value: string;
  isBlocked: boolean;
};

export function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesAsTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getMinutesSinceMidnight(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();

  return date.getSeconds() > 0 || date.getMilliseconds() > 0 ? minutes + 1 : minutes;
}

export function isPastDateValue(dateValue: string, todayValue: string) {
  return dateValue < todayValue;
}

function getOpenTimeOptions(
  dateValue: string,
  settings: RestaurantSettings,
  now: Date
) {
  if (!dateValue) return [];
  const todayValue = formatDateValue(now);
  if (isPastDateValue(dateValue, todayValue)) return [];

  const currentTimeMinimum =
    dateValue === todayValue ? getMinutesSinceMidnight(now) : null;

  const selectedDay = parseDateValue(dateValue).getDay();
  const matchingHours = settings.opening_hours.filter(
    (openingHour) => openingHour.day_of_week === selectedDay
  );

  if (matchingHours.length === 0 || matchingHours.every((openingHour) => openingHour.is_closed)) {
    return [];
  }

  const slots = matchingHours.flatMap((openingHour) => {
    if (openingHour.is_closed) return [];

    const start = parseTimeToMinutes(openingHour.opens_at);
    const close = parseTimeToMinutes(openingHour.closes_at);
    const lastReservation = parseTimeToMinutes(
      openingHour.last_reservation_time || openingHour.closes_at
    );

    if (start === null || close === null || lastReservation === null) {
      return [];
    }

    const firstSlot = Math.ceil(start / slotIntervalMinutes) * slotIntervalMinutes;
    const lastSlot = Math.min(close, lastReservation);
    const minimumSlot =
      currentTimeMinimum === null ? firstSlot : Math.max(firstSlot, currentTimeMinimum);
    const daySlots: string[] = [];

    for (let slot = firstSlot; slot <= lastSlot; slot += slotIntervalMinutes) {
      if (slot < minimumSlot) continue;

      daySlots.push(formatMinutesAsTime(slot));
    }

    return daySlots;
  });

  return Array.from(new Set(slots)).sort();
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function isReservationTimeBlocked(
  dateValue: string,
  timeValue: string,
  settings: RestaurantSettings
) {
  const slotStart = parseTimeToMinutes(timeValue);

  if (slotStart === null) {
    return true;
  }

  const slotEnd = slotStart + slotIntervalMinutes;

  return settings.reservation_blocks.some(
    (block) =>
      block.date === dateValue &&
      rangesOverlap(slotStart, slotEnd, block.start_minutes, block.end_minutes)
  );
}

export function getTimeSlotOptions(
  dateValue: string,
  settings: RestaurantSettings,
  now: Date
): TimeSlotOption[] {
  return getOpenTimeOptions(dateValue, settings, now).map((value) => ({
    value,
    isBlocked: isReservationTimeBlocked(dateValue, value, settings)
  }));
}

export function getAvailableTimeOptions(
  dateValue: string,
  settings: RestaurantSettings,
  now: Date
) {
  return getTimeSlotOptions(dateValue, settings, now)
    .filter((option) => !option.isBlocked)
    .map((option) => option.value);
}

export function isReservationTimeAvailable(
  dateValue: string,
  timeValue: string,
  settings: RestaurantSettings,
  now: Date
) {
  return getAvailableTimeOptions(dateValue, settings, now).includes(timeValue);
}
