import { NextResponse } from "next/server";
import { getRestaurantSettings } from "@/lib/restaurants";
import { isReservationTimeAvailable } from "@/lib/reservationAvailability";
import { validateReservationInput } from "@/lib/validation";

const validationMessage = "Please check the reservation details and try again.";
const successMessage =
  "Your reservation request has been received. It is not confirmed yet. The restaurant will review it and contact you shortly.";
const unavailableMessage =
  "This time may not be available. Please choose another time or contact the restaurant directly.";
const errorMessage =
  "Something went wrong while submitting your reservation. Please try again or contact the restaurant directly.";

type N8nResponseBody = {
  success?: boolean;
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: validationMessage },
      { status: 400 }
    );
  }

  const validation = validateReservationInput(body);

  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        message: validationMessage,
        errors: validation.errors
      },
      { status: 400 }
    );
  }

  if (validation.honeypot) {
    return NextResponse.json(
      { success: true, message: successMessage },
      { status: 200 }
    );
  }

  if (validation.payload.restaurant_slug) {
    const settings = await getRestaurantSettings(validation.payload.restaurant_slug);

    if (
      !settings ||
      !isReservationTimeAvailable(
        validation.payload.date,
        validation.payload.time,
        settings,
        new Date()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAVAILABLE",
          message: unavailableMessage
        },
        { status: 409 }
      );
    }
  }

  const webhookUrl = process.env.N8N_RESERVATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(validation.payload)
    });

    const webhookText = await webhookResponse.text();
    const webhookBody = parseWebhookBody(webhookText);

    if (isUnavailableResponse(webhookResponse.status, webhookBody)) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAVAILABLE",
          message: unavailableMessage
        },
        { status: 409 }
      );
    }

    if (!webhookResponse.ok || webhookBody?.success === false) {
      logWebhookFailure(webhookResponse.status, webhookBody, webhookText);

      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: successMessage },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reservation webhook request failed", {
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

function parseWebhookBody(text: string): N8nResponseBody | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as N8nResponseBody;
  } catch {
    return null;
  }
}

function logWebhookFailure(
  status: number,
  body: N8nResponseBody | null,
  text: string
) {
  console.error("Reservation webhook returned an error", {
    status,
    code: body?.code,
    responseStatus: body?.status,
    message: body?.message,
    responsePreview: text.slice(0, 300)
  });
}

function isUnavailableResponse(status: number, body: N8nResponseBody | null) {
  const code = normalizeWebhookField(body?.code);
  const bodyStatus = normalizeWebhookField(body?.status);
  const message = normalizeWebhookField(body?.message);

  return (
    status === 409 ||
    code === "UNAVAILABLE" ||
    bodyStatus === "UNAVAILABLE" ||
    message?.includes("UNAVAILABLE") === true
  );
}

function normalizeWebhookField(value: unknown) {
  return typeof value === "string" ? value.toUpperCase() : undefined;
}
