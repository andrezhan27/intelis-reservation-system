import { normalizeLanguage } from "@/lib/i18n";
import { getFontFamilyStack } from "@/lib/fonts";
import { getSupabaseAnonClient } from "@/lib/supabase";
import type { RestaurantOpeningHour, RestaurantSettings } from "@/lib/types";

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
  day_of_week: number | null;
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

function normalizeTimeValue(time: string | null) {
  return time?.slice(0, 5) || "";
}

function normalizeOpeningHours(rows: OpeningHourRow[] | null): RestaurantOpeningHour[] {
  if (!rows) return [];

  return rows
    .map((row) => ({
      day_of_week: row.day_of_week ?? -1,
      opens_at: normalizeTimeValue(row.opens_at),
      closes_at: normalizeTimeValue(row.closes_at),
      last_reservation_time: row.last_reservation_time
        ? normalizeTimeValue(row.last_reservation_time)
        : null,
      is_closed: row.is_closed === true
    }))
    .filter((row) => row.day_of_week >= 0 && row.day_of_week <= 6);
}

export async function getRestaurantSettings(
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

  const { data: openingHoursData } = await supabase
    .from("restaurant_opening_hours")
    .select(openingHourColumns)
    .eq("restaurant_id", data.id)
    .order("day_of_week", { ascending: true })
    .order("opens_at", { ascending: true })
    .returns<OpeningHourRow[]>();

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
