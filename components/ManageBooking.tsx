"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { managementCopy } from "@/lib/managementI18n";
import {
  formatDateValue,
  getTimeSlotSections
} from "@/lib/reservationAvailability";
import type {
  ManagementBooking,
  ManagementBookingStatus,
  ManagementRestaurant
} from "@/lib/manageBooking";
import type { RestaurantSettings, WidgetLanguage } from "@/lib/types";

type ManageAction = "details" | "modify" | "cancel";

type Props = {
  token: string;
  booking: ManagementBooking;
  restaurant: ManagementRestaurant;
  availabilitySettings: RestaurantSettings | null;
  initialAction: ManageAction;
};

type FormValues = {
  date: string;
  time: string;
  party_size: number;
  special_requests: string;
};

type ApiResponse = {
  success?: boolean;
  pending?: boolean;
  already_cancelled?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const localeByLanguage: Record<WidgetLanguage, string> = {
  en: "en-GB",
  pt: "pt-PT",
  zh: "zh-CN"
};

const languageOptions: Array<{ label: string; value: WidgetLanguage }> = [
  { label: "EN", value: "en" },
  { label: "PT", value: "pt" },
  { label: "中文", value: "zh" }
];

const managementLanguageStorageKey = "reservation-management-language";

export function ManageBooking({
  token,
  booking,
  restaurant,
  availabilitySettings,
  initialAction
}: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState<WidgetLanguage>("pt");
  const t = managementCopy[language];
  const [action, setAction] = useState<ManageAction>(initialAction);
  const [displayBooking, setDisplayBooking] = useState(booking);
  const [values, setValues] = useState<FormValues>(() => formValuesFromBooking(booking));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = useMemo(() => formatDateValue(new Date()), []);
  const canManage = ["PENDING", "CONFIRMED", "MODIFIED"].includes(
    displayBooking.status
  );
  const timeSections = useMemo(() => {
    if (!availabilitySettings) return [];

    return getTimeSlotSections(values.date, availabilitySettings, new Date());
  }, [availabilitySettings, values.date]);
  const availableTimes = useMemo(
    () =>
      Array.from(
        new Set(
          timeSections
            .flatMap((section) => section.options)
            .filter((option) => !option.isBlocked)
            .map((option) => option.value)
        )
      ).sort(),
    [timeSections]
  );
  const selectableTimes = useMemo(() => {
    if (!values.time || availableTimes.includes(values.time)) return availableTimes;

    return [values.time, ...availableTimes].sort();
  }, [availableTimes, values.time]);
  const maxPartySize = availabilitySettings?.max_party_size ?? null;

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(managementLanguageStorageKey);

    if (savedLanguage === "en" || savedLanguage === "pt" || savedLanguage === "zh") {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    if (action !== "modify") return;

    if (
      values.time &&
      !availableTimes.includes(values.time) &&
      !(values.date === displayBooking.date && values.time === displayBooking.time)
    ) {
      setValues((current) => ({ ...current, time: "" }));
    }
  }, [action, availableTimes, displayBooking.date, displayBooking.time, values.date, values.time]);

  function openAction(nextAction: ManageAction) {
    setMessage(null);
    setErrors({});

    if (nextAction === "modify") {
      setValues(formValuesFromBooking(displayBooking));
    }

    setAction(nextAction);
  }

  function selectLanguage(nextLanguage: WidgetLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(managementLanguageStorageKey, nextLanguage);
  }

  function updateValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setMessage(null);
  }

  function shiftPartySize(change: -1 | 1) {
    const nextPartySize = Math.max(1, values.party_size + change);
    const boundedPartySize =
      maxPartySize === null
        ? nextPartySize
        : Math.min(maxPartySize, nextPartySize);
    updateValue("party_size", boundedPartySize);
  }

  async function submitModification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      const response = await fetch(`/api/manage-booking/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const body = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || body?.success === false) {
        setErrors(body?.errors || {});
        setMessage(body?.message || t.requestError);
        setMessageType("error");
        return;
      }

      setMessage(body?.message || t.save);
      setMessageType("success");

      if (body?.pending !== true) {
        setDisplayBooking((current) => ({
          ...current,
          ...values,
          status: "CONFIRMED"
        }));
      }

      setAction("details");
      router.refresh();
    } catch {
      setMessage(t.requestError);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmCancellation() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/manage-booking/${encodeURIComponent(token)}/cancel`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || body?.success === false) {
        setMessage(body?.message || t.requestError);
        setMessageType("error");
        return;
      }

      setDisplayBooking((current) => ({ ...current, status: "CANCELLED" }));
      setMessage(body?.message || t.cancelledTitle);
      setMessageType("success");
      setAction("details");
      router.refresh();
    } catch {
      setMessage(t.requestError);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const bookingDetails = (
    <dl className="management-details-grid">
      <Detail label={t.customer} value={displayBooking.name} />
      {action === "modify" ? (
        <EditableDetail
          label={t.date}
          modified={values.date !== displayBooking.date}
          error={errors.date}
        >
          <DatePickerControl
            value={values.date}
            displayValue={formatDisplayDate(values.date, language)}
            minimum={today}
            label={t.chooseDate}
            onChange={(value) => updateValue("date", value)}
          />
        </EditableDetail>
      ) : (
        <Detail
          label={t.date}
          value={formatDisplayDate(displayBooking.date, language)}
        />
      )}

      {action === "modify" ? (
        <EditableDetail
          label={t.time}
          modified={values.time !== displayBooking.time}
          error={errors.time}
        >
          <TimePickerControl
            value={values.time || "—"}
            times={selectableTimes}
            label={t.chooseTime}
            onChange={(value) => updateValue("time", value)}
          />
        </EditableDetail>
      ) : (
        <Detail label={t.time} value={displayBooking.time} />
      )}

      {action === "modify" ? (
        <EditableDetail
          label={t.guests}
          modified={values.party_size !== displayBooking.party_size}
          error={errors.party_size}
        >
          <ValueStepper
            value={String(values.party_size)}
            previousLabel={t.decreaseGuests}
            nextLabel={t.increaseGuests}
            previousSymbol="−"
            nextSymbol="+"
            previousDisabled={values.party_size <= 1}
            nextDisabled={
              maxPartySize !== null && values.party_size >= maxPartySize
            }
            onPrevious={() => shiftPartySize(-1)}
            onNext={() => shiftPartySize(1)}
          />
        </EditableDetail>
      ) : (
        <Detail label={t.guests} value={String(displayBooking.party_size)} />
      )}

      {action === "modify" ? (
        <EditableDetail
          label={t.notes}
          modified={values.special_requests !== displayBooking.special_requests}
          error={errors.special_requests}
          fullWidth
        >
          <textarea
            id="manage-special-requests"
            rows={2}
            maxLength={2000}
            value={values.special_requests}
            aria-label={t.notes}
            aria-invalid={Boolean(errors.special_requests)}
            onChange={(event) =>
              updateValue("special_requests", event.target.value)
            }
          />
        </EditableDetail>
      ) : (
        <Detail
          label={t.notes}
          value={displayBooking.special_requests || t.noNotes}
          fullWidth
        />
      )}
    </dl>
  );

  const confirmationNote =
    restaurant.require_confirmation && canManage ? (
      <p className="management-confirmation-note">{t.pendingNotice}</p>
    ) : null;

  return (
    <div className="management-layout">
      <aside className="management-visual-column">
        <div className="management-photo-card" aria-label={restaurant.name}>
          {restaurant.photo_url ? (
            <img
              className="management-photo"
              src={restaurant.photo_url}
              alt={restaurant.name}
            />
          ) : (
            <div className="management-photo-placeholder">
              <span>{restaurant.name}</span>
            </div>
          )}
        </div>

      </aside>

      <section className="management-card" aria-labelledby="management-title">

      <div className="management-heading">
        <div>
          <p className="management-eyebrow">{restaurant.name}</p>
          <h1 id="management-title">{t.pageTitle}</h1>
          <p>{t.pageSubtitle}</p>
        </div>
        <div className="management-heading-meta">
          <div className="language-switcher" aria-label="Language">
            {languageOptions.map((option) => (
              <button
                className="language-button"
                type="button"
                key={option.value}
                aria-pressed={language === option.value}
                onClick={() => selectLanguage(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <StatusBadge status={displayBooking.status} language={language} />
        </div>
      </div>

      {message ? (
        <div
          className={`management-message ${messageType}`}
          role={messageType === "error" ? "alert" : "status"}
        >
          {message}
        </div>
      ) : null}

      {displayBooking.status === "CANCELLED" ? (
        <div className="management-cancelled-state">
          <span className="management-cancelled-icon" aria-hidden="true">✓</span>
          <div>
            <h2>{t.cancelledTitle}</h2>
            <p>{t.cancelledDescription}</p>
          </div>
        </div>
      ) : null}

      {canManage && action === "modify" ? (
        <form className="management-inline-edit" onSubmit={submitModification} noValidate>
          {bookingDetails}
          {confirmationNote}
          <div className="management-actions">
            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.saving : t.save}
            </button>
            <button
              className="management-secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => openAction("details")}
            >
              {t.back}
            </button>
          </div>
        </form>
      ) : (
        <>
          {bookingDetails}
          {confirmationNote}
        </>
      )}

      {canManage && action === "details" ? (
        <div className="management-actions">
          <button className="submit-button" type="button" onClick={() => openAction("modify")}>
            {t.modify}
          </button>
          <button className="management-danger-outline" type="button" onClick={() => openAction("cancel")}>
            {t.cancel}
          </button>
        </div>
      ) : null}

      {canManage && action === "cancel" ? (
        <div className="management-cancel-confirmation" role="alertdialog" aria-labelledby="cancel-title">
          <h2 id="cancel-title">{t.cancelTitle}</h2>
          <p>{t.cancelDescription}</p>
          <div className="management-actions">
            <button className="management-danger-button" type="button" disabled={isSubmitting} onClick={confirmCancellation}>
              {isSubmitting ? t.cancelling : t.confirmCancel}
            </button>
            <button className="management-secondary-button" type="button" disabled={isSubmitting} onClick={() => openAction("details")}>
              {t.back}
            </button>
          </div>
        </div>
      ) : null}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  fullWidth = false
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`management-detail${fullWidth ? " full-width" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EditableDetail({
  label,
  modified,
  error,
  fullWidth = false,
  children
}: {
  label: string;
  modified: boolean;
  error?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const classes = [
    "management-detail",
    "is-editing",
    modified ? "is-modified" : "",
    fullWidth ? "full-width" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <dt>{label}</dt>
      <dd>{children}</dd>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

function ValueStepper({
  value,
  previousLabel,
  nextLabel,
  previousSymbol = "‹",
  nextSymbol = "›",
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext
}: {
  value: string;
  previousLabel: string;
  nextLabel: string;
  previousSymbol?: string;
  nextSymbol?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="management-value-stepper">
      <button
        className="management-step-button"
        type="button"
        aria-label={previousLabel}
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        {previousSymbol}
      </button>
      <span className="management-step-value management-edit-value">{value}</span>
      <button
        className="management-step-button"
        type="button"
        aria-label={nextLabel}
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextSymbol}
      </button>
    </div>
  );
}

function DatePickerControl({
  value,
  displayValue,
  minimum,
  label,
  onChange
}: {
  value: string;
  displayValue: string;
  minimum: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="management-picker-control">
      <span className="management-edit-value">{displayValue}</span>
      <label className="management-picker-trigger" title={label}>
        <CalendarIcon />
        <input
          type="date"
          value={value}
          min={minimum}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function TimePickerControl({
  value,
  times,
  label,
  onChange
}: {
  value: string;
  times: string[];
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="management-picker-control">
      <span className="management-edit-value">{value}</span>
      <label className="management-picker-trigger" title={label}>
        <ClockIcon />
        <select
          value={value === "—" ? "" : value}
          aria-label={label}
          disabled={times.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          {value === "—" ? <option value="">—</option> : null}
          {times.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function StatusBadge({
  status,
  language
}: {
  status: ManagementBookingStatus;
  language: WidgetLanguage;
}) {
  const t = managementCopy[language];
  const labelByStatus: Record<ManagementBookingStatus, string> = {
    PENDING: t.statusPending,
    CONFIRMED: t.statusConfirmed,
    MODIFIED: t.statusModified,
    CANCELLED: t.statusCancelled,
    REJECTED: t.statusRejected,
    NO_SHOW: t.statusNoShow
  };

  return (
    <span className={`management-status status-${status.toLowerCase()}`}>
      {labelByStatus[status]}
    </span>
  );
}

function formValuesFromBooking(booking: ManagementBooking): FormValues {
  return {
    date: booking.date,
    time: booking.time,
    party_size: booking.party_size,
    special_requests: booking.special_requests
  };
}

function formatDisplayDate(value: string, language: WidgetLanguage) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  const weekday = new Intl.DateTimeFormat(localeByLanguage[language], {
    weekday: "long"
  }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${weekday}, ${day}/${month}/${date.getFullYear()}`;
}
