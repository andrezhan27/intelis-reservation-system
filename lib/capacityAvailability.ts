import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { MealPeriod } from "@/lib/types";

export type MealPeriodCapacityAvailability = Partial<Record<MealPeriod, boolean>>;

type CapacityRow = {
  meal_period: string | null;
  max_seats: number | null;
};

type BookingRow = {
  meal_period: string | null;
  party_size: number | null;
};

export type CapacityAvailabilityResult =
  | { ok: true; mealPeriods: MealPeriodCapacityAvailability }
  | { ok: false };

const capacityMealPeriods = new Set<MealPeriod>(["Lunch", "Dinner"]);
const capacityBookingStatuses = ["PENDING", "CONFIRMED", "MODIFIED"];

export async function getCapacityAvailability(
  restaurantId: string,
  dateValue: string,
  partySize: number
): Promise<CapacityAvailabilityResult> {
  const supabase = getSupabaseAdminClient();
  const dayOfWeek = getDayOfWeek(dateValue);

  if (!supabase || dayOfWeek === null || !Number.isInteger(partySize) || partySize < 1) {
    return { ok: false };
  }

  const [capacityResult, bookingsResult] = await Promise.all([
    supabase
      .from("capacity")
      .select("meal_period,max_seats")
      .eq("restaurant_id", restaurantId)
      .eq("dow_id", dayOfWeek)
      .returns<CapacityRow[]>(),
    supabase
      .from("bookings")
      .select("meal_period,party_size")
      .eq("restaurant_id", restaurantId)
      .eq("date", dateValue)
      .in("status", capacityBookingStatuses)
      .returns<BookingRow[]>()
  ]);

  if (capacityResult.error || bookingsResult.error) {
    console.error("Failed to calculate reservation capacity", {
      capacityError: capacityResult.error?.message,
      bookingsError: bookingsResult.error?.message,
      restaurantId,
      date: dateValue
    });

    return { ok: false };
  }

  const maximumSeats = new Map<MealPeriod, number>();

  for (const row of capacityResult.data || []) {
    const mealPeriod = normalizeCapacityMealPeriod(row.meal_period);
    const maxSeats = row.max_seats;

    if (
      !mealPeriod ||
      typeof maxSeats !== "number" ||
      !Number.isFinite(maxSeats)
    ) {
      continue;
    }

    maximumSeats.set(
      mealPeriod,
      Math.max(maximumSeats.get(mealPeriod) ?? 0, Math.max(0, Math.floor(maxSeats)))
    );
  }

  const bookedSeats = new Map<MealPeriod, number>();

  for (const row of bookingsResult.data || []) {
    const mealPeriod = normalizeCapacityMealPeriod(row.meal_period);
    const bookedPartySize = row.party_size;

    if (
      !mealPeriod ||
      typeof bookedPartySize !== "number" ||
      !Number.isFinite(bookedPartySize)
    ) {
      continue;
    }

    bookedSeats.set(
      mealPeriod,
      (bookedSeats.get(mealPeriod) ?? 0) + Math.max(0, Math.floor(bookedPartySize))
    );
  }

  const mealPeriods: MealPeriodCapacityAvailability = {};

  for (const [mealPeriod, maxSeats] of maximumSeats) {
    mealPeriods[mealPeriod] =
      (bookedSeats.get(mealPeriod) ?? 0) + partySize <= maxSeats;
  }

  return { ok: true, mealPeriods };
}

function getDayOfWeek(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.getUTCDay();
}

function normalizeCapacityMealPeriod(value: string | null): MealPeriod | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  const mealPeriod =
    normalized === "lunch"
      ? "Lunch"
      : normalized === "dinner"
        ? "Dinner"
        : normalized === "all day" || normalized === "all-day" || normalized === "allday"
          ? "All Day"
          : null;

  return mealPeriod && capacityMealPeriods.has(mealPeriod) ? mealPeriod : null;
}
