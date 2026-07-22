export type WidgetLanguage = "en" | "pt" | "zh";
export type MealPeriod = "Lunch" | "Dinner" | "All Day";

export type RestaurantSettings = {
  restaurant_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  language: WidgetLanguage;
  booking_widget_enabled: boolean;
  min_party_size: number;
  reservation_times: ReservationTime[];
  reservation_blocks: ReservationBlock[];
  privacy_policy_url: string;
  privacy_policy_version: string;
  terms_url: string | null;
};

export type ReservationBlock = {
  date: string;
  start_minutes: number;
  end_minutes: number;
};

export type ReservationTime = {
  day_of_week: number;
  meal_period: MealPeriod;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

export type ReservationFormValues = {
  restaurant_id: string;
  restaurant_slug: string;
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  party_size: number;
  special_requests: string;
  marketing_consent: boolean;
  privacy_policy_accepted: boolean;
  privacy_policy_version: string;
  website?: string;
};

export type ReservationWebhookPayload = {
  restaurant_id: string | null;
  restaurant_slug: string | null;
  name: string;
  phone_number: string;
  email: string;
  date: string;
  time: string;
  party_size: number;
  special_requests: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_source: "website_widget";
  privacy_policy_accepted: boolean;
  privacy_policy_accepted_at: string;
  privacy_policy_version: string;
  source: "website_widget";
  submitted_at: string;
};
