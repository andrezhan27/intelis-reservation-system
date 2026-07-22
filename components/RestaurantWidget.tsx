"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReservationForm } from "@/components/ReservationForm";
import { copy } from "@/lib/i18n";
import { getSupabaseAnonClient } from "@/lib/supabase";
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
  const router = useRouter();
  const [language, setLanguage] = useState<WidgetLanguage>("pt");
  const refreshTimeoutRef = useRef<number | null>(null);
  const t = copy[language];

  useEffect(() => {
    const supabase = getSupabaseAnonClient();

    function scheduleRefresh() {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 350);
    }

    const pollIntervalId = window.setInterval(scheduleRefresh, 30000);

    if (!supabase) {
      return () => {
        window.clearInterval(pollIntervalId);

        if (refreshTimeoutRef.current !== null) {
          window.clearTimeout(refreshTimeoutRef.current);
        }
      };
    }

    const channel = supabase
      .channel(`restaurant-settings:${settings.slug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${settings.restaurant_id}`
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_times",
          filter: `restaurant_id=eq.${settings.restaurant_id}`
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_blocks",
          filter: `restaurant_id=eq.${settings.slug}`
        },
        scheduleRefresh
      );

    if (settings.restaurant_id !== settings.slug) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_blocks",
          filter: `restaurant_id=eq.${settings.restaurant_id}`
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      window.clearInterval(pollIntervalId);

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [router, settings.restaurant_id, settings.slug]);

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
