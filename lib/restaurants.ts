import { unstable_cache } from "next/cache";
import { normalizeLanguage } from "@/lib/i18n";
import { getFontFamilyStack } from "@/lib/fonts";
import { getSupabaseAnonClient } from "@/lib/supabase";
import type { RestaurantOpeningHour, RestaurantSettings } from "@/lib/types";

export const restaurantSettingsCacheSeconds = 5 * 60;
const settingsCacheTtlMs = restaurantSettingsCacheSeconds * 1000;
const settingsCache = new Map<
  string,
  {
    expiresAt: number;
    value: RestaurantSettings | null;
  }
>();

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

function normalizeDayOfWeek(row: OpeningHourRow) {
  if (typeof row.dow_id === "number") {
    return row.dow_id;
  }

  if (typeof row.day_of_week === "number") {
    return row.day_of_week;
  }

  if (typeof row.day_of_week === "string") {
    const dayName = row.day_of_week
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return dayNameToIndex[dayName] ?? -1;
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

  const openingHoursData = await getOpeningHoursData(supabase, data.id);

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
    privacy_policy_url: data.privacy_policy_url || "#",
    privacy_policy_version: data.privacy_policy_version || "current",
    terms_url: null
  };
}

const getCachedRestaurantSettings = unstable_cache(
  async (restaurantSlug: string) => fetchRestaurantSettings(restaurantSlug),
  ["restaurant-settings"],
  { revalidate: restaurantSettingsCacheSeconds }
);

export async function getRestaurantSettings(
  restaurantSlug: string
): Promise<RestaurantSettings | null> {
  const cacheKey = restaurantSlug.trim().toLowerCase();
  const cachedSettings = settingsCache.get(cacheKey);

  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value;
  }

  const settings = await getCachedRestaurantSettings(restaurantSlug.trim());

  settingsCache.set(cacheKey, {
    expiresAt: Date.now() + settingsCacheTtlMs,
    value: settings
  });

  return settings;
}
