import type { ReservationFormValues, ReservationWebhookPayload } from "@/lib/types";

export type ValidationResult =
  | { ok: true; payload: ReservationWebhookPayload; honeypot: false }
  | { ok: true; honeypot: true }
  | { ok: false; errors: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asPartySize(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  return Number.NaN;
}

export function validateReservationInput(input: unknown): ValidationResult {
  const data = (input ?? {}) as Partial<ReservationFormValues>;
  const errors: Record<string, string> = {};

  const restaurantId = asString(data.restaurant_id);
  const restaurantSlug = asString(data.restaurant_slug);
  const name = asString(data.name);
  const phone = asString(data.phone);
  const email = asString(data.email).toLowerCase();
  const date = asString(data.date);
  const time = asString(data.time);
  const partySize = asPartySize(data.party_size);
  const specialRequests = asString(data.special_requests);
  const marketingConsent = asBoolean(data.marketing_consent);
  const privacyAccepted = asBoolean(data.privacy_policy_accepted);
  const privacyPolicyVersion = asString(data.privacy_policy_version);
  const website = asString(data.website);

  if (website) {
    return { ok: true, honeypot: true };
  }

  if (!restaurantId && !restaurantSlug) {
    errors.restaurant = "Restaurant is required.";
  }
  if (!name) errors.name = "Name is required.";
  if (!phone) errors.phone = "Phone is required.";
  if (!email) errors.email = "Email is required.";
  if (email && !emailPattern.test(email)) errors.email = "Email is invalid.";
  if (!date) errors.date = "Date is required.";
  if (date && !datePattern.test(date)) errors.date = "Date is invalid.";
  if (!time) errors.time = "Time is required.";
  if (time && !timePattern.test(time)) errors.time = "Time is invalid.";
  if (!Number.isInteger(partySize) || partySize < 1) {
    errors.party_size = "Party size must be at least 1.";
  }
  if (!privacyAccepted) {
    errors.privacy_policy_accepted = "Privacy Policy acceptance is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, honeypot: false, payload: createPayload() };

  function createPayload(): ReservationWebhookPayload {
    const now = new Date().toISOString();

    return {
      restaurant_id: restaurantId || null,
      restaurant_slug: restaurantSlug || null,
      name,
      phone_number: phone,
      email,
      date,
      time,
      party_size: Number.isFinite(partySize) ? partySize : 1,
      special_requests: specialRequests,
      marketing_consent: marketingConsent,
      marketing_consent_at: marketingConsent ? now : null,
      marketing_consent_source: "website_widget",
      privacy_policy_accepted: privacyAccepted,
      privacy_policy_accepted_at: now,
      privacy_policy_version: privacyPolicyVersion || "current",
      source: "website_widget",
      submitted_at: now
    };
  }
}
