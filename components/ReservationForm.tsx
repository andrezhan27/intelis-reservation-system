"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { countryDialCodes, defaultDialCountryId } from "@/lib/countryDialCodes";
import { copy } from "@/lib/i18n";
import {
  addDays,
  formatDateValue,
  getAvailableTimeOptions,
  isPastDateValue,
  parseDateValue
} from "@/lib/reservationAvailability";
import type {
  ReservationFormValues,
  RestaurantSettings,
  WidgetLanguage
} from "@/lib/types";

type Props = {
  settings: RestaurantSettings;
  language: WidgetLanguage;
};

type FormErrors = Partial<Record<keyof ReservationFormValues, string>>;
type SubmitState = "idle" | "submitting" | "success" | "error";
type ReservationApiResponse = {
  success: boolean;
  code?: string;
  message?: string;
  errors?: FormErrors;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateWindowSize = 7;
const localeByLanguage: Record<WidgetLanguage, string> = {
  en: "en-GB",
  pt: "pt-PT",
  zh: "zh-CN"
};
const dateCardWeekdays: Record<WidgetLanguage, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
  zh: ["日", "一", "二", "三", "四", "五", "六"]
};

function getNextWeekendDate(date: Date) {
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
  return addDays(date, daysUntilSaturday);
}

function formatSelectedDate(dateValue: string, language: WidgetLanguage) {
  return new Intl.DateTimeFormat(localeByLanguage[language], {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(parseDateValue(dateValue));
}

function formatDateWindowLabel(startDate: Date, endDate: Date, language: WidgetLanguage) {
  const formatter = new Intl.DateTimeFormat(localeByLanguage[language], {
    day: "numeric",
    month: "short"
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatDateCardWeekday(date: Date, language: WidgetLanguage) {
  return dateCardWeekdays[language][date.getDay()];
}

function formatMinimumGuestsMessage(template: string, count: number) {
  return template.replace("{count}", String(count));
}

function normalizeCountrySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatPhoneForSubmission(dialCode: string, phone: string) {
  const trimmedPhone = phone.trim();

  if (trimmedPhone.startsWith("+")) {
    return trimmedPhone.replace(/[^\d+]/g, "");
  }

  if (trimmedPhone.startsWith("00")) {
    return `+${trimmedPhone.slice(2).replace(/\D/g, "")}`;
  }

  return `${dialCode}${trimmedPhone.replace(/\D/g, "")}`;
}

export function ReservationForm({ settings, language }: Props) {
  const t = copy[language];
  const minPartySize = Math.max(1, settings.min_party_size || 1);
  const initialPartySize = Math.max(2, minPartySize);
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => formatDateValue(now), [now]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [dateWindowIndex, setDateWindowIndex] = useState(0);
  const [selectedDialCountryId, setSelectedDialCountryId] = useState(defaultDialCountryId);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const selectedDialCountry =
    countryDialCodes.find((country) => country.id === selectedDialCountryId) || countryDialCodes[0];
  const [values, setValues] = useState<ReservationFormValues>({
    restaurant_id: settings.restaurant_id,
    restaurant_slug: settings.slug,
    name: "",
    phone: "",
    email: "",
    date: today,
    time: "",
    party_size: initialPartySize,
    special_requests: "",
    marketing_consent: false,
    privacy_policy_accepted: false,
    privacy_policy_version: settings.privacy_policy_version,
    website: ""
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const dateQuickOptions = useMemo(() => {
    const todayDate = parseDateValue(today);

    return [
      { label: t.today, value: formatDateValue(todayDate) },
      { label: t.tomorrow, value: formatDateValue(addDays(todayDate, 1)) },
      { label: t.nextWeekend, value: formatDateValue(getNextWeekendDate(todayDate)) }
    ];
  }, [t.nextWeekend, t.today, t.tomorrow, today]);
  const dateWindowStart = useMemo(
    () => addDays(parseDateValue(today), dateWindowIndex * dateWindowSize),
    [dateWindowIndex, today]
  );
  const dateWindowEnd = useMemo(
    () => addDays(dateWindowStart, dateWindowSize - 1),
    [dateWindowStart]
  );
  const selectableDates = useMemo(() => {
    return Array.from({ length: dateWindowSize }, (_, index) => {
      const date = addDays(dateWindowStart, index);
      const value = formatDateValue(date);

      return {
        value,
        day: new Intl.DateTimeFormat(localeByLanguage[language], {
          day: "numeric"
        }).format(date),
        month: new Intl.DateTimeFormat(localeByLanguage[language], {
          month: "short"
        }).format(date),
        weekday: formatDateCardWeekday(date, language)
      };
    });
  }, [dateWindowStart, language]);
  const availableTimeOptions = useMemo(
    () => getAvailableTimeOptions(values.date, settings, now),
    [settings, values.date, now]
  );
  const filteredDialCountries = useMemo(() => {
    const searchTerm = normalizeCountrySearch(countrySearch.trim());

    if (!searchTerm) {
      return countryDialCodes;
    }

    return countryDialCodes.filter((country) => {
      const searchable = normalizeCountrySearch(
        `${country.country} ${country.code} ${country.id}`
      );

      return searchable.includes(searchTerm);
    });
  }, [countrySearch]);

  useEffect(() => {
    if (values.date && isPastDateValue(values.date, today)) {
      setValues((current) => ({ ...current, date: today, time: "" }));
      return;
    }

    if (values.time && !availableTimeOptions.includes(values.time)) {
      setValues((current) => ({ ...current, time: "" }));
    }
  }, [availableTimeOptions, today, values.date, values.time]);

  useEffect(() => {
    if (!isCountryMenuOpen) {
      return;
    }

    countrySearchRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!countryDropdownRef.current?.contains(event.target as Node)) {
        setIsCountryMenuOpen(false);
        setCountrySearch("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCountryMenuOpen(false);
        setCountrySearch("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCountryMenuOpen]);

  function updateValue<K extends keyof ReservationFormValues>(
    key: K,
    value: ReservationFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateClient() {
    const nextErrors: FormErrors = {};

    if (!values.name.trim()) nextErrors.name = t.required;
    if (!values.phone.trim()) nextErrors.phone = t.required;
    if (!values.email.trim()) nextErrors.email = t.required;
    if (values.email && !emailPattern.test(values.email)) nextErrors.email = t.invalidEmail;
    if (!values.date) nextErrors.date = t.required;
    if (!values.time) nextErrors.time = availableTimeOptions.length > 0 ? t.required : t.noTimes;
    if (values.date && isPastDateValue(values.date, today)) nextErrors.date = t.required;
    if (values.time && !availableTimeOptions.includes(values.time)) nextErrors.time = t.noTimes;
    if (!Number.isInteger(values.party_size) || values.party_size < minPartySize) {
      nextErrors.party_size = formatMinimumGuestsMessage(t.minGuests, minPartySize);
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function selectDialCountry(countryId: string) {
    setSelectedDialCountryId(countryId);
    setIsCountryMenuOpen(false);
    setCountrySearch("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    if (!validateClient()) {
      return;
    }

    setSubmitState("submitting");

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...values,
          phone: formatPhoneForSubmission(selectedDialCountry.code, values.phone),
          privacy_policy_accepted: true
        })
      });

      const body = (await response.json().catch(() => null)) as
        | ReservationApiResponse
        | null;

      if (body?.errors) {
        setErrors(body.errors);
      }

      if (!response.ok || body?.success === false) {
        setStatusMessage(body?.message || t.error);
        setSubmitState("error");
        return;
      }

      setStatusMessage(null);
      setSubmitState("success");
    } catch {
      setStatusMessage(t.error);
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <div className="success-card" role="status">
        <div className="success-mark" aria-hidden="true" />
        <div>
          <h2>{t.successTitle}</h2>
          <p>{statusMessage || t.success}</p>
          <p className="success-note">{t.successNote}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="reservation-form" onSubmit={handleSubmit} noValidate>
      {submitState === "error" ? (
        <div className="status-message error" role="alert">
          {statusMessage || t.error}
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">{t.name}</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <span className="field-error">{errors.name}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="phone">{t.phone}</label>
          <div className="phone-input-group">
            <div className="country-code-combobox" ref={countryDropdownRef}>
              <button
                type="button"
                className="country-code-trigger"
                aria-controls="country-code-options"
                aria-expanded={isCountryMenuOpen}
                aria-haspopup="listbox"
                aria-label={`${t.countryCode}: ${selectedDialCountry.country} ${selectedDialCountry.code}`}
                onClick={() => setIsCountryMenuOpen((isOpen) => !isOpen)}
              >
                <span>
                  {selectedDialCountry.flag} {selectedDialCountry.code}
                </span>
                <span className="country-code-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>
              {isCountryMenuOpen ? (
                <div className="country-code-menu">
                  <input
                    ref={countrySearchRef}
                    className="country-code-search"
                    type="search"
                    autoComplete="off"
                    placeholder={t.countryCodeSearch}
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                  />
                  <div
                    id="country-code-options"
                    className="country-code-options"
                    role="listbox"
                    aria-label={t.countryCode}
                  >
                    {filteredDialCountries.length > 0 ? (
                      filteredDialCountries.map((country) => (
                        <button
                          type="button"
                          className="country-code-option"
                          key={country.id}
                          role="option"
                          aria-selected={selectedDialCountryId === country.id}
                          onClick={() => selectDialCountry(country.id)}
                        >
                          <span className="country-code-option-main">
                            <span>{country.flag}</span>
                            <span>{country.country}</span>
                          </span>
                          <span>{country.code}</span>
                        </button>
                      ))
                    ) : (
                      <span className="country-code-empty">{t.noCountryCodes}</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              placeholder={t.phonePlaceholder}
              value={values.phone}
              onChange={(event) => updateValue("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
            />
          </div>
          {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? <span className="field-error">{errors.email}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="party_size">{t.partySize}</label>
          <div className="guest-stepper">
            <button
              type="button"
              aria-label="Decrease guests"
              disabled={values.party_size <= minPartySize}
              onClick={() =>
                updateValue("party_size", Math.max(minPartySize, values.party_size - 1))
              }
            >
              -
            </button>
            <input
              id="party_size"
              name="party_size"
              type="number"
              min={minPartySize}
              inputMode="numeric"
              value={values.party_size}
              onChange={(event) =>
                updateValue("party_size", Number.parseInt(event.target.value, 10) || 0)
              }
              aria-invalid={Boolean(errors.party_size)}
            />
            <button
              type="button"
              aria-label="Increase guests"
              onClick={() => updateValue("party_size", values.party_size + 1)}
            >
              +
            </button>
          </div>
          {errors.party_size ? (
            <span className="field-error">{errors.party_size}</span>
          ) : null}
        </div>

        <div className="field field-full reservation-slot-field">
          <div className="slot-picker-grid">
            <section className="slot-picker-card" aria-label={t.selectDate}>
              <div className="picker-heading">
                <span className="field-label">{t.date}</span>
                <span>{formatSelectedDate(values.date, language)}</span>
              </div>
              <input id="date" name="date" type="hidden" value={values.date} />

              <div className="quick-options date-presets" aria-label={t.date}>
                {dateQuickOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    aria-pressed={values.date === option.value}
                    onClick={() => updateValue("date", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="date-picker-grid">
                {selectableDates.map((option) => (
                  <button
                    type="button"
                    className="date-option"
                    key={option.value}
                    aria-pressed={values.date === option.value}
                    onClick={() => updateValue("date", option.value)}
                  >
                    <span>{option.weekday}</span>
                    <strong>{option.day}</strong>
                    <span>{option.month}</span>
                  </button>
                ))}
              </div>
              <div className="date-picker-footer">
                <button
                  type="button"
                  className="date-window-button"
                  aria-label={t.previousWeek}
                  disabled={dateWindowIndex === 0}
                  onClick={() => setDateWindowIndex((current) => Math.max(0, current - 1))}
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <span>
                  {dateWindowIndex === 0
                    ? t.nextSevenDays
                    : formatDateWindowLabel(dateWindowStart, dateWindowEnd, language)}
                </span>
                <button
                  type="button"
                  className="date-window-button"
                  aria-label={t.nextWeek}
                  onClick={() => setDateWindowIndex((current) => current + 1)}
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              {errors.date ? <span className="field-error">{errors.date}</span> : null}
            </section>

            <section className="slot-picker-card" aria-label={t.selectTime}>
              <div className="picker-heading">
                <span className="field-label">{t.time}</span>
                <span>{values.time || t.selectTime}</span>
              </div>
              <input id="time" name="time" type="hidden" value={values.time} />

              {availableTimeOptions.length > 0 ? (
                <div className="time-slot-grid" aria-label={t.time}>
                  {availableTimeOptions.map((option) => (
                    <button
                      type="button"
                      className="time-slot-button"
                      key={option}
                      aria-pressed={values.time === option}
                      onClick={() => updateValue("time", option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-picker-state">{t.noTimes}</p>
              )}
              {errors.time ? <span className="field-error">{errors.time}</span> : null}
            </section>
          </div>
        </div>

        <div className="field field-full">
          <label htmlFor="special_requests">{t.specialRequests}</label>
          <textarea
            id="special_requests"
            name="special_requests"
            placeholder={t.specialRequestsPlaceholder}
            value={values.special_requests}
            onChange={(event) => updateValue("special_requests", event.target.value)}
          />
        </div>
      </div>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => updateValue("website", event.target.value)}
        />
      </div>

      <div className="consent-area">
        <label className="checkbox-row" htmlFor="marketing_consent">
          <input
            id="marketing_consent"
            name="marketing_consent"
            type="checkbox"
            checked={values.marketing_consent}
            onChange={(event) => updateValue("marketing_consent", event.target.checked)}
          />
          <span>{t.marketingConsent}</span>
        </label>

        <p className="privacy-notice">
          {t.privacyNotice}{" "}
          <a href={settings.privacy_policy_url} target="_blank" rel="noreferrer">
            {t.privacyPolicy}
          </a>
          {settings.terms_url ? (
            <>
              {" "}
              {t.and}{" "}
              <a href={settings.terms_url} target="_blank" rel="noreferrer">
                {t.terms}
              </a>
            </>
          ) : null}
          .
        </p>
      </div>

      <button className="submit-button" type="submit" disabled={submitState === "submitting"}>
        {submitState === "submitting" ? t.submitting : t.submit}
      </button>
    </form>
  );
}
