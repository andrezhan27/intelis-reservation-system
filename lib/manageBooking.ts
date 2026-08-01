import "server-only";
import { getFontFamilyStack } from "@/lib/fonts";
import { normalizeLanguage } from "@/lib/i18n";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { WidgetLanguage } from "@/lib/types";

export type ManagementBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "MODIFIED"
  | "NO_SHOW"
  | "REJECTED";

export type ManagementBooking = {
  reservation_id: string;
  restaurant_id: string;
  date: string;
  time: string;
  meal_period: string;
  name: string;
  party_size: number;
  status: ManagementBookingStatus;
  special_requests: string;
  customer_status: string;
  updated_at: string | null;
};

export type ManagementRestaurant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  photo_url: string | null;
  primary_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  language: WidgetLanguage;
  min_party_size: number;
  require_confirmation: boolean;
};

export type ManagementBookingContext = {
  booking: ManagementBooking;
  restaurant: ManagementRestaurant;
};

export type ManagementBookingLookup =
  | { ok: true; context: ManagementBookingContext }
  | { ok: false; reason: "not_found" | "configuration" };

type BookingRow = {
  reservation_id: string;
  restaurant_id: string;
  date: string;
  time: string;
  meal_period: string;
  name: string;
  party_size: number;
  status: string;
  special_requests: string | null;
  customer_status: string | null;
  updated_at: string | null;
};

type RestaurantRow = {
  id: string;
  slug: string | null;
  name: string;
  logo_url: string | null;
  photo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  text_color: string | null;
  font_family: string | null;
  language: string | null;
  min_party_size: number | null;
  require_confirmation: boolean | null;
  active: boolean | null;
};

const bookingColumns = [
  "reservation_id",
  "restaurant_id",
  "date",
  "time",
  "meal_period",
  "name",
  "party_size",
  "status",
  "special_requests",
  "customer_status",
  "updated_at"
].join(",");

const restaurantColumns = [
  "id",
  "slug",
  "name",
  "logo_url",
  "photo_url",
  "primary_color",
  "background_color",
  "text_color",
  "font_family",
  "language",
  "min_party_size",
  "require_confirmation",
  "active"
].join(",");

const knownStatuses = new Set<ManagementBookingStatus>([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "MODIFIED",
  "NO_SHOW",
  "REJECTED"
]);

export function normalizeManagementToken(value: string) {
  const token = value.trim();

  if (token.length < 16 || token.length > 256 || /\s/.test(token)) {
    return null;
  }

  return token;
}

export function canModifyBooking(status: ManagementBookingStatus) {
  return status === "PENDING" || status === "CONFIRMED" || status === "MODIFIED";
}

export function canCancelBooking(status: ManagementBookingStatus) {
  return status === "PENDING" || status === "CONFIRMED" || status === "MODIFIED";
}

export async function loadManagementBooking(
  rawToken: string
): Promise<ManagementBookingLookup> {
  const token = normalizeManagementToken(rawToken);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { ok: false, reason: "configuration" };
  }

  if (!token) {
    return { ok: false, reason: "not_found" };
  }

  const bookingResult = await supabase
    .from("bookings")
    .select(bookingColumns)
    .eq("customer_management_token", token)
    .maybeSingle<BookingRow>();

  if (bookingResult.error || !bookingResult.data) {
    if (bookingResult.error) {
      console.error("Failed to load a managed booking", {
        code: bookingResult.error.code,
        message: bookingResult.error.message
      });
    }

    return { ok: false, reason: "not_found" };
  }

  const restaurantResult = await supabase
    .from("restaurants")
    .select(restaurantColumns)
    .eq("id", bookingResult.data.restaurant_id)
    .eq("active", true)
    .maybeSingle<RestaurantRow>();

  if (restaurantResult.error || !restaurantResult.data?.slug) {
    if (restaurantResult.error) {
      console.error("Failed to load the managed booking restaurant", {
        code: restaurantResult.error.code,
        message: restaurantResult.error.message
      });
    }

    return { ok: false, reason: "not_found" };
  }

  const status = normalizeStatus(bookingResult.data.status);

  return {
    ok: true,
    context: {
      booking: {
        reservation_id: bookingResult.data.reservation_id,
        restaurant_id: bookingResult.data.restaurant_id,
        date: bookingResult.data.date,
        time: bookingResult.data.time.slice(0, 5),
        meal_period: bookingResult.data.meal_period,
        name: bookingResult.data.name,
        party_size: bookingResult.data.party_size,
        status,
        special_requests: bookingResult.data.special_requests || "",
        customer_status: bookingResult.data.customer_status || "RESERVED",
        updated_at: bookingResult.data.updated_at
      },
      restaurant: {
        id: restaurantResult.data.id,
        slug: restaurantResult.data.slug,
        name: restaurantResult.data.name,
        logo_url: restaurantResult.data.logo_url,
        photo_url: restaurantResult.data.photo_url,
        primary_color: restaurantResult.data.primary_color || "#8b2f22",
        background_color: restaurantResult.data.background_color || "#fffaf3",
        text_color: restaurantResult.data.text_color || "#251f1a",
        font_family: getFontFamilyStack(restaurantResult.data.font_family),
        language: normalizeLanguage(restaurantResult.data.language),
        min_party_size: Math.max(1, restaurantResult.data.min_party_size || 1),
        require_confirmation: restaurantResult.data.require_confirmation === true
      }
    }
  };
}

function normalizeStatus(value: string): ManagementBookingStatus {
  const status = value.trim().toUpperCase() as ManagementBookingStatus;

  return knownStatuses.has(status) ? status : "PENDING";
}
