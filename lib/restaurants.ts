import { unstable_noStore as noStore } from "next/cache";
import { normalizeLanguage } from "@/lib/i18n";
import { getFontFamilyStack } from "@/lib/fonts";
import { getSupabaseAnonClient } from "@/lib/supabase";
import type {
  ReservationBlock,
  RestaurantOpeningHour,
  RestaurantSettings
} from "@/lib/types";

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  text_color: string | null;
  font_family: string | null;
  language: string | null;
  booking_widget_enabled: boolean | null;
  min_party_size?: number | null;
  privacy_policy_url: string | null;
  privacy_policy_version: string | null;
};

type OpeningHourRow = {
  day_of_week?: number | string | null;
  dow_id?: number | null;
  opens_at: string | null;
  closes_at: string | null;
  last_reservation_time: string | null;
  is_closed: boolean | null;
};

type ReservationBlockRow = {
  starts_at: string | null;
  ends_at: string | null;
};

type ReservationBlockTimestamp = {
  date: string;
  minutes: number;
  dateValue: number;
};

const basePublicColumns = [
  "id",
  "slug",
  "name",
  "logo_url",
  "primary_color",
  "background_color",
  "text_color",
  "font_family",
  "language",
  "booking_widget_enabled",
  "privacy_policy_url",
  "privacy_policy_version"
];

const publicColumns = [...basePublicColumns, "min_party_size"].join(",");
const legacyPublicColumns = basePublicColumns.join(",");

const openingHourColumns = [
  "day_of_week",
  "opens_at",
  "closes_at",
  "last_reservation_time",
  "is_closed"
].join(",");
const legacyOpeningHourColumns = openingHourColumns;
const publicOpeningHourColumns = [
  "dow_id",
  "day_of_week",
  "opens_at",
  "closes_at",
  "last_reservation_time",
  "is_closed"
].join(",");
const reservationBlockColumns = ["starts_at", "ends_at"].join(",");

const dayNameToIndex: Record<string, number> = {
  sunday: 0,
  sun: 0,
  domingo: 0,
  monday: 1,
  mon: 1,
  segunda: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  terca: 2,
  wednesday: 3,
  wed: 3,
  quarta: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  quinta: 4,
  friday: 5,
  fri: 5,
  sexta: 5,
  saturday: 6,
  sat: 6,
  sabado: 6
};

function normalizeTimeValue(time: string | null) {
  return time?.slice(0, 5) || "";
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, (month || 1) - 1, day || 1);
}

function getDateValue(date: string) {
  return parseDateValue(date).getTime();
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseReservationBlockTimestamp(
  value: string
): ReservationBlockTimestamp | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  const parsedSeconds = Number(seconds || "0");

  if (
    !Number.isFinite(parsedHours) ||
    !Number.isFinite(parsedMinutes) ||
    parsedHours > 23 ||
    parsedMinutes > 59 ||
    parsedSeconds > 59
  ) {
    return null;
  }

  const date = `${year}-${month}-${day}`;

  return {
    date,
    minutes: parsedHours * 60 + parsedMinutes + (parsedSeconds > 0 ? 1 : 0),
    dateValue: getDateValue(date)
  };
}

function normalizeDayOfWeek(row: OpeningHourRow) {
  if (typeof row.day_of_week === "string") {
    const dayName = row.day_of_week
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const dayIndex = dayNameToIndex[dayName];

    if (dayIndex !== undefined) {
      return dayIndex;
    }
  }

  if (typeof row.day_of_week === "number") {
    return row.day_of_week;
  }

  if (typeof row.dow_id === "number") {
    return row.dow_id;
  }

  return -1;
}

function normalizeOpeningHours(rows: OpeningHourRow[] | null): RestaurantOpeningHour[] {
  if (!rows) return [];

  return rows
    .map((row) => ({
      day_of_week: normalizeDayOfWeek(row),
      opens_at: normalizeTimeValue(row.opens_at),
      closes_at: normalizeTimeValue(row.closes_at),
      last_reservation_time: row.last_reservation_time
        ? normalizeTimeValue(row.last_reservation_time)
        : null,
      is_closed: row.is_closed === true
    }))
    .filter((row) => row.day_of_week >= 0 && row.day_of_week <= 6);
}

function normalizeReservationBlocks(rows: ReservationBlockRow[] | null): ReservationBlock[] {
  if (!rows) return [];

  return rows.flatMap((row) => {
    if (!row.starts_at || !row.ends_at) return [];

    const startsAt = parseReservationBlockTimestamp(row.starts_at);
    const endsAt = parseReservationBlockTimestamp(row.ends_at);

    if (
      !startsAt ||
      !endsAt ||
      endsAt.dateValue < startsAt.dateValue ||
      (endsAt.dateValue === startsAt.dateValue && endsAt.minutes <= startsAt.minutes)
    ) {
      return [];
    }

    const blocks: ReservationBlock[] = [];

    for (
      let dayStart = getStartOfDay(parseDateValue(startsAt.date));
      dayStart.getTime() <= endsAt.dateValue;
      dayStart = addDays(dayStart, 1)
    ) {
      const dayValue = dayStart.getTime();
      const startMinutes = dayValue === startsAt.dateValue
        ? startsAt.minutes
        : 0;
      const endMinutes = dayValue === endsAt.dateValue
        ? endsAt.minutes
        : 24 * 60;

      if (endMinutes > startMinutes) {
        blocks.push({
          date: formatDateValue(dayStart),
          start_minutes: startMinutes,
          end_minutes: endMinutes
        });
      }
    }

    return blocks;
  });
}

async function getOpeningHoursData(
  supabase: NonNullable<ReturnType<typeof getSupabaseAnonClient>>,
  restaurantId: string
) {
  const openingHoursResult = await supabase
    .from("opening_hours")
    .select(publicOpeningHourColumns)
    .eq("restaurant_id", restaurantId)
    .order("dow_id", { ascending: true })
    .order("opens_at", { ascending: true })
    .returns<OpeningHourRow[]>();

  if (openingHoursResult.data?.length) {
    return openingHoursResult.data;
  }

  const restaurantOpeningHoursResult = await supabase
    .from("restaurant_opening_hours")
    .select(legacyOpeningHourColumns)
    .eq("restaurant_id", restaurantId)
    .order("day_of_week", { ascending: true })
    .order("opens_at", { ascending: true })
    .returns<OpeningHourRow[]>();

  return restaurantOpeningHoursResult.data || openingHoursResult.data;
}

async function getReservationBlocksData(
  supabase: NonNullable<ReturnType<typeof getSupabaseAnonClient>>,
  restaurantId: string,
  restaurantSlug: string
) {
  const restaurantIds = Array.from(new Set([restaurantSlug, restaurantId].filter(Boolean)));
  const reservationBlocksResult = await supabase
    .from("reservation_blocks")
    .select(reservationBlockColumns)
    .in("restaurant_id", restaurantIds)
    .eq("active", true)
    .contains("channels", ["website_widget"])
    .order("starts_at", { ascending: true })
    .returns<ReservationBlockRow[]>();

  if (reservationBlocksResult.error) {
    console.error("Failed to load reservation blocks", {
      message: reservationBlocksResult.error.message
    });
  }

  return reservationBlocksResult.data || [];
}

async function fetchRestaurantSettings(
  restaurantSlug: string
): Promise<RestaurantSettings | null> {
  const supabase = getSupabaseAnonClient();

  if (!supabase) {
    return null;
  }

  let { data, error } = await supabase
    .from("restaurants")
    .select(publicColumns)
    .eq("slug", restaurantSlug)
    .eq("active", true)
    .eq("booking_widget_enabled", true)
    .maybeSingle<RestaurantRow>();

  if (error && error.message.includes("min_party_size")) {
    const legacyResult = await supabase
      .from("restaurants")
      .select(legacyPublicColumns)
      .eq("slug", restaurantSlug)
      .eq("active", true)
      .eq("booking_widget_enabled", true)
      .maybeSingle<RestaurantRow>();

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    return null;
  }

  const [openingHoursData, reservationBlocksData] = await Promise.all([
    getOpeningHoursData(supabase, data.id),
    getReservationBlocksData(supabase, data.id, data.slug)
  ]);

  return {
    restaurant_id: data.id,
    slug: data.slug,
    name: data.name,
    logo_url: data.logo_url,
    primary_color: data.primary_color || "#8b2f22",
    background_color: data.background_color || "#fffaf3",
    text_color: data.text_color || "#251f1a",
    font_family: getFontFamilyStack(data.font_family),
    language: normalizeLanguage(data.language),
    booking_widget_enabled: data.booking_widget_enabled === true,
    min_party_size: Math.max(1, data.min_party_size || 1),
    opening_hours: normalizeOpeningHours(openingHoursData),
    reservation_blocks: normalizeReservationBlocks(reservationBlocksData),
    privacy_policy_url: data.privacy_policy_url || "#",
    privacy_policy_version: data.privacy_policy_version || "current",
    terms_url: null
  };
}

export async function getRestaurantSettings(
  restaurantSlug: string
): Promise<RestaurantSettings | null> {
  noStore();

  return fetchRestaurantSettings(restaurantSlug.trim());
}
