import type { CSSProperties } from "react";
import { RestaurantWidget } from "@/components/RestaurantWidget";
import { getGoogleFontStylesheetUrl } from "@/lib/fonts";
import { copy } from "@/lib/i18n";
import { getRestaurantSettings } from "@/lib/restaurants";

type PageProps = {
  params: Promise<{
    restaurantSlug: string;
  }>;
};

export default async function RestaurantWidgetPage({ params }: PageProps) {
  const { restaurantSlug } = await params;
  const settings = await getRestaurantSettings(decodeURIComponent(restaurantSlug));

  if (!settings) {
    return (
      <main className="widget-shell">
        <section className="widget-container">
          <div className="empty-state">{copy.en.notFound}</div>
        </section>
      </main>
    );
  }

  const fontStylesheetUrl = getGoogleFontStylesheetUrl(settings.font_family);
  const cssVariables = {
    "--primary-color": settings.primary_color,
    "--background-color": settings.background_color,
    "--text-color": settings.text_color,
    "--font-family": settings.font_family
  } as CSSProperties;

  return (
    <>
      {fontStylesheetUrl ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fontStylesheetUrl} />
        </>
      ) : null}

      <main className="widget-shell" style={cssVariables}>
        <RestaurantWidget settings={settings} />
      </main>
    </>
  );
}
