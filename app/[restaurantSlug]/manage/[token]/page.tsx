import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { ManageBooking } from "@/components/ManageBooking";
import { getGoogleFontStylesheetUrl } from "@/lib/fonts";
import { loadManagementBooking } from "@/lib/manageBooking";
import { managementCopy } from "@/lib/managementI18n";
import { getRestaurantSettings } from "@/lib/restaurants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Manage reservation",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

type PageProps = {
  params: Promise<{
    restaurantSlug: string;
    token: string;
  }>;
  searchParams: Promise<{
    action?: string | string[];
  }>;
};

export default async function ManageBookingPage({ params, searchParams }: PageProps) {
  const [{ restaurantSlug, token }, query] = await Promise.all([params, searchParams]);
  const decodedSlug = decodeURIComponent(restaurantSlug);
  const lookup = await loadManagementBooking(token);

  if (!lookup.ok || lookup.context.restaurant.slug !== decodedSlug) {
    return <ManagementErrorPage />;
  }

  const { booking, restaurant } = lookup.context;
  const availabilitySettings = await getRestaurantSettings(restaurant.slug);
  const fontStylesheetUrl = getGoogleFontStylesheetUrl(restaurant.font_family);
  const cssVariables = {
    "--primary-color": restaurant.primary_color,
    "--background-color": restaurant.background_color,
    "--text-color": restaurant.text_color,
    "--font-family": restaurant.font_family
  } as CSSProperties;
  const requestedAction = Array.isArray(query.action) ? query.action[0] : query.action;
  const initialAction =
    requestedAction === "modify" || requestedAction === "cancel"
      ? requestedAction
      : "details";

  return (
    <>
      <FontLinks stylesheetUrl={fontStylesheetUrl} />
      <main className="widget-shell management-shell" style={cssVariables}>
        <div className="management-container">
          <ManageBooking
            token={token}
            booking={booking}
            restaurant={restaurant}
            availabilitySettings={availabilitySettings}
            initialAction={initialAction}
          />
        </div>
      </main>
    </>
  );
}

function ManagementErrorPage() {
  const t = managementCopy.pt;

  return (
    <main className="widget-shell management-shell">
      <div className="management-container">
        <section className="management-card management-error-card">
          <div className="management-error-icon" aria-hidden="true">!</div>
          <h1>{t.linkErrorTitle}</h1>
          <p>{t.linkErrorDescription}</p>
        </section>
      </div>
    </main>
  );
}

function FontLinks({ stylesheetUrl }: { stylesheetUrl: string | null }): ReactNode {
  if (!stylesheetUrl) return null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={stylesheetUrl} />
    </>
  );
}
