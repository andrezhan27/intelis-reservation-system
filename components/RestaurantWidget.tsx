"use client";

import { useState } from "react";
import { ReservationForm } from "@/components/ReservationForm";
import { copy } from "@/lib/i18n";
import type { RestaurantSettings, WidgetLanguage } from "@/lib/types";

type Props = {
  settings: RestaurantSettings;
};

const languageOptions: Array<{ label: string; value: WidgetLanguage }> = [
  { label: "EN", value: "en" },
  { label: "PT", value: "pt" },
  { label: "中文", value: "zh" }
];

export function RestaurantWidget({ settings }: Props) {
  const [language, setLanguage] = useState<WidgetLanguage>("pt");
  const t = copy[language];

  return (
    <section className="widget-container" aria-labelledby="reservation-title">
      <div className="widget-topbar" aria-label="Language">
        <div className="language-switcher">
          {languageOptions.map((option) => (
            <button
              className="language-button"
              type="button"
              key={option.value}
              aria-pressed={language === option.value}
              onClick={() => setLanguage(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="brand-block">
        {settings.logo_url ? (
          <img className="brand-logo" src={settings.logo_url} alt={`${settings.name} logo`} />
        ) : null}
        <h1 className="brand-name" id="reservation-title">
          {settings.name}
        </h1>
        <p className="brand-subtitle">{t.subtitle}</p>
      </div>

      {settings.booking_widget_enabled ? (
        <ReservationForm settings={settings} language={language} />
      ) : (
        <div className="empty-state">{t.disabled}</div>
      )}
    </section>
  );
}
