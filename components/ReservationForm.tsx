"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatPhoneForSubmission,
  isValidEmailAddress,
  isValidPhoneNumberForCountry
} from "@/lib/contactValidation";
import { countryDialCodes, defaultDialCountryId } from "@/lib/countryDialCodes";
import { copy, mealPeriodCopy } from "@/lib/i18n";
import {
  addDays,
  formatDateValue,
  getTimeSlotSections,
  isPastDateValue,
  parseDateValue
} from "@/lib/reservationAvailability";
import type {
  MealPeriod,
  ReservationFormValues,
  RestaurantSettings,
  WidgetLanguage
} from "@/lib/types";

type Props = {
  settings: RestaurantSettings;
  language: WidgetLanguage;
};

type FormError =
  | string
  | { code: "required" | "invalidPhone" | "invalidEmail" | "noTimes" }
  | { code: "minGuests" | "maxGuests"; count: number };
type FormErrors = Partial<Record<keyof ReservationFormValues, FormError>>;
type ContactField = "phone" | "email";
type SubmitState = "idle" | "submitting" | "success" | "error";
type ReservationApiResponse = {
  success: boolean;
  code?: string;
  message?: string;
  confirmation_required?: boolean;
  errors?: Partial<Record<keyof ReservationFormValues, string>>;
};
type CapacityApiResponse = {
  success?: boolean;
  meal_periods?: Partial<Record<MealPeriod, boolean>>;
};
type CapacityAvailabilityState = {
  requestKey: string;
  status: "loading" | "ready" | "error";
  mealPeriods: Partial<Record<MealPeriod, boolean>>;
};

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

function getCapacityDisplayStatus(
  mealPeriod: MealPeriod,
  requestKey: string,
  availability: CapacityAvailabilityState | null
) {
  if (mealPeriod === "All Day") return "available" as const;
  if (!availability || availability.requestKey !== requestKey) {
    return "loading" as const;
  }
  if (availability.status === "error") return "error" as const;
  if (availability.status === "loading") return "loading" as const;

  return availability.mealPeriods[mealPeriod] === false
    ? "unavailable" as const
    : "available" as const;
}

export function ReservationForm({ settings, language }: Props) {
  const t = copy[language];
  const minPartySize = Math.max(1, settings.min_party_size || 1);
  const maxPartySize = settings.max_party_size;
  const initialPartySize =
    maxPartySize === null
      ? Math.max(2, minPartySize)
      : Math.min(maxPartySize, Math.max(2, minPartySize));
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => formatDateValue(now), [now]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(
    settings.require_confirmation
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [touchedContactFields, setTouchedContactFields] = useState<
    Record<ContactField, boolean>
  >({ phone: false, email: false });
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
  const [capacityAvailability, setCapacityAvailability] =
    useState<CapacityAvailabilityState | null>(null);
  const [capacityRefreshVersion, setCapacityRefreshVersion] = useState(0);
  const capacityRequestKey = `${values.date}:${values.party_size}`;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      !values.date ||
      !Number.isInteger(values.party_size) ||
      values.party_size < 1
    ) {
      return;
    }

    const controller = new AbortController();
    const requestKey = `${values.date}:${values.party_size}`;

    setCapacityAvailability((current) =>
      current?.requestKey === requestKey
        ? current
        : { requestKey, status: "loading", mealPeriods: {} }
    );

    void fetch(
      `/api/availability?restaurant_slug=${encodeURIComponent(settings.slug)}` +
        `&date=${encodeURIComponent(values.date)}` +
        `&party_size=${values.party_size}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | CapacityApiResponse
          | null;

        if (!response.ok || body?.success !== true || !body.meal_periods) {
          throw new Error("Availability request failed");
        }

        setCapacityAvailability({
          requestKey,
          status: "ready",
          mealPeriods: body.meal_periods
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setCapacityAvailability({ requestKey, status: "error", mealPeriods: {} });
      });

    return () => controller.abort();
  }, [capacityRefreshVersion, now, settings.slug, values.date, values.party_size]);

  useEffect(() => {
    if (maxPartySize === null) return;

    setValues((current) =>
      current.party_size > maxPartySize
        ? { ...current, party_size: maxPartySize }
        : current
    );
  }, [maxPartySize]);

  const dateQuickOptions = useMemo(() => {
    const todayDate = parseDateValue(today);

    return [
      { id: "today", label: t.today, value: formatDateValue(todayDate) },
      { id: "tomorrow", label: t.tomorrow, value: formatDateValue(addDays(todayDate, 1)) },
      {
        id: "next-weekend",
        label: t.nextWeekend,
        value: formatDateValue(getNextWeekendDate(todayDate))
      }
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
  const timeSlotSections = useMemo(
    () => getTimeSlotSections(values.date, settings, now),
    [settings, values.date, now]
  );
  const availableTimeOptions = useMemo(
    () =>
      timeSlotSections
        .filter(
          (section) =>
            section.mealPeriod === "All Day" ||
            (capacityAvailability?.requestKey === capacityRequestKey &&
              capacityAvailability.status === "ready" &&
              capacityAvailability.mealPeriods[section.mealPeriod] !== false)
        )
        .flatMap((section) => section.options)
        .filter((option) => !option.isBlocked)
        .map((option) => option.value),
    [capacityAvailability, capacityRequestKey, timeSlotSections]
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

    if (key === "phone" && touchedContactFields.phone) {
      setErrors((current) => ({
        ...current,
        phone: getPhoneError(String(value))
      }));
      return;
    }

    if (key === "email" && touchedContactFields.email) {
      setErrors((current) => ({
        ...current,
        email: getEmailError(String(value))
      }));
      return;
    }

    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function getPhoneError(
    phone: string,
    countryId = selectedDialCountry.id,
    dialCode = selectedDialCountry.code
  ) {
    if (!phone.trim()) return { code: "required" } as const;
    if (!isValidPhoneNumberForCountry(countryId, dialCode, phone)) {
      return { code: "invalidPhone" } as const;
    }

    return undefined;
  }

  function getEmailError(email: string) {
    if (!email.trim()) return { code: "required" } as const;
    if (!isValidEmailAddress(email)) return { code: "invalidEmail" } as const;

    return undefined;
  }

  function getErrorMessage(error: FormError | undefined) {
    if (!error) return undefined;
    if (typeof error === "string") return error;
    if (error.code === "minGuests" || error.code === "maxGuests") {
      return formatMinimumGuestsMessage(t[error.code], error.count);
    }

    return t[error.code];
  }

  function validateContactField(field: ContactField) {
    setTouchedContactFields((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: field === "phone" ? getPhoneError(values.phone) : getEmailError(values.email)
    }));
  }

  function validateClient() {
    const nextErrors: FormErrors = {};
    const phoneError = getPhoneError(values.phone);
    const emailError = getEmailError(values.email);

    if (!values.name.trim()) nextErrors.name = { code: "required" };
    if (phoneError) nextErrors.phone = phoneError;
    if (emailError) nextErrors.email = emailError;
    if (!values.date) nextErrors.date = { code: "required" };
    if (!values.time) {
      nextErrors.time = {
        code: availableTimeOptions.length > 0 ? "required" : "noTimes"
      };
    }
    if (values.date && isPastDateValue(values.date, today)) {
      nextErrors.date = { code: "required" };
    }
    if (values.time && !availableTimeOptions.includes(values.time)) {
      nextErrors.time = { code: "noTimes" };
    }
    if (!Number.isInteger(values.party_size) || values.party_size < minPartySize) {
      nextErrors.party_size = { code: "minGuests", count: minPartySize };
    } else if (maxPartySize !== null && values.party_size > maxPartySize) {
      nextErrors.party_size = { code: "maxGuests", count: maxPartySize };
    }
    setErrors(nextErrors);
    setTouchedContactFields({ phone: true, email: true });
    return Object.keys(nextErrors).length === 0;
  }

  function selectDialCountry(countryId: string) {
    const country =
      countryDialCodes.find((candidate) => candidate.id === countryId) || countryDialCodes[0];

    setSelectedDialCountryId(countryId);
    if (touchedContactFields.phone) {
      setErrors((current) => ({
        ...current,
        phone: getPhoneError(values.phone, country.id, country.code)
      }));
    }
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
          phone: formatPhoneForSubmission(
            selectedDialCountry.id,
            selectedDialCountry.code,
            values.phone
          ),
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
        if (body?.code === "UNAVAILABLE") {
          setCapacityRefreshVersion((current) => current + 1);
        }
        setStatusMessage(body?.message || t.error);
        setSubmitState("error");
        return;
      }

      setStatusMessage(null);
      setConfirmationRequired(
        typeof body?.confirmation_required === "boolean"
          ? body.confirmation_required
          : settings.require_confirmation
      );
      setSubmitState("success");
    } catch {
      setStatusMessage(t.error);
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    const successTitle = confirmationRequired
      ? t.successTitle
      : t.confirmedSuccessTitle;
    const successMessage = confirmationRequired ? t.success : t.confirmedSuccess;
    const successNote = confirmationRequired ? t.successNote : t.confirmedSuccessNote;

    return (
      <div className="success-card" role="status">
        <div className="success-mark" aria-hidden="true" />
        <div>
          <h2>{successTitle}</h2>
          <p>{statusMessage || successMessage}</p>
          <p className="success-note">{successNote}</p>
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
          {errors.name ? (
            <span className="field-error">{getErrorMessage(errors.name)}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="phone">{t.phone}</label>
          <div className={`phone-input-group${errors.phone ? " invalid" : ""}`}>
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
              maxLength={30}
              value={values.phone}
              onChange={(event) => updateValue("phone", event.target.value)}
              onBlur={() => validateContactField("phone")}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "phone-error" : undefined}
            />
          </div>
          {errors.phone ? (
            <span id="phone-error" className="field-error">
              {getErrorMessage(errors.phone)}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            maxLength={254}
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            onBlur={() => validateContactField("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? (
            <span id="email-error" className="field-error">
              {getErrorMessage(errors.email)}
            </span>
          ) : null}
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
              max={maxPartySize ?? undefined}
              inputMode="numeric"
              value={values.party_size}
              onChange={(event) => {
                const nextPartySize = Number.parseInt(event.target.value, 10) || 0;

                updateValue(
                  "party_size",
                  maxPartySize === null
                    ? nextPartySize
                    : Math.min(maxPartySize, nextPartySize)
                );
              }}
              aria-invalid={Boolean(errors.party_size)}
            />
            <button
              type="button"
              aria-label="Increase guests"
              disabled={maxPartySize !== null && values.party_size >= maxPartySize}
              onClick={() =>
                updateValue(
                  "party_size",
                  maxPartySize === null
                    ? values.party_size + 1
                    : Math.min(maxPartySize, values.party_size + 1)
                )
              }
            >
              +
            </button>
          </div>
          {errors.party_size ? (
            <span className="field-error">{getErrorMessage(errors.party_size)}</span>
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
                    key={option.id}
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
              {errors.date ? (
                <span className="field-error">{getErrorMessage(errors.date)}</span>
              ) : null}
            </section>

            <section className="slot-picker-card" aria-label={t.selectTime}>
              <div className="picker-heading">
                <span className="field-label">{t.time}</span>
                <span>{values.time || t.selectTime}</span>
              </div>
              <input id="time" name="time" type="hidden" value={values.time} />

              {timeSlotSections.length > 0 ? (
                <div className="time-slot-sections" aria-label={t.time}>
                  {timeSlotSections.map((section) => {
                    const capacityStatus = getCapacityDisplayStatus(
                      section.mealPeriod,
                      capacityRequestKey,
                      capacityAvailability
                    );

                    return (
                      <div className="time-slot-section" key={section.mealPeriod}>
                        <h3>{mealPeriodCopy[language][section.mealPeriod]}</h3>
                        {capacityStatus === "available" ? (
                          <div className="time-slot-grid">
                            {section.options.map((option) => (
                              <button
                                type="button"
                                className="time-slot-button"
                                key={`${section.mealPeriod}-${option.value}`}
                                aria-pressed={values.time === option.value}
                                disabled={option.isBlocked}
                                title={option.isBlocked ? t.error : undefined}
                                onClick={() => updateValue("time", option.value)}
                              >
                                {option.value}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-picker-state" role="status">
                            {capacityStatus === "unavailable"
                              ? t.mealPeriodFull
                              : capacityStatus === "error"
                                ? t.availabilityCheckError
                                : t.checkingAvailability}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-picker-state">{t.noTimes}</p>
              )}
              {errors.time ? (
                <span className="field-error">{getErrorMessage(errors.time)}</span>
              ) : null}
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
          .
        </p>
      </div>

      <button className="submit-button" type="submit" disabled={submitState === "submitting"}>
        {submitState === "submitting" ? t.submitting : t.submit}
      </button>
    </form>
  );
}
