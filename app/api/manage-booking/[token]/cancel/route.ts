import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  canCancelBooking,
  loadManagementBooking
} from "@/lib/manageBooking";
import { callManagementWebhook } from "@/lib/n8nManagement";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const genericErrorMessage =
  "Não foi possível cancelar a reserva. Tente novamente ou contacte o restaurante.";

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const lookup = await loadManagementBooking(token);

  if (!lookup.ok) {
    return json(
      { success: false, message: genericErrorMessage },
      { status: lookup.reason === "configuration" ? 500 : 404 }
    );
  }

  const { booking } = lookup.context;

  if (booking.status === "CANCELLED") {
    return json({
      success: true,
      already_cancelled: true,
      message: "A reserva já se encontra cancelada."
    });
  }

  if (!canCancelBooking(booking.status)) {
    return json(
      { success: false, message: "Esta reserva já não pode ser cancelada." },
      { status: 409 }
    );
  }

  const requestedAt = new Date().toISOString();
  const result = await callManagementWebhook("N8N_CANCEL_BOOKING_WEBHOOK_URL", {
    event: "CUSTOMER_RESERVATION_CANCELLATION_REQUESTED",
    request_id: randomUUID(),
    idempotency_key: createHash("sha256")
      .update(`CANCEL:${booking.reservation_id}`)
      .digest("hex"),
    requested_at: requestedAt,
    reservation_id: booking.reservation_id,
    restaurant_id: booking.restaurant_id,
    original: {
      date: booking.date,
      time: booking.time,
      party_size: booking.party_size,
      special_requests: booking.special_requests,
      status: booking.status
    }
  });

  if (!result.ok) {
    return json({ success: false, message: genericErrorMessage }, { status: 500 });
  }

  return json({
    success: true,
    already_cancelled: false,
    message: "A reserva foi cancelada com sucesso."
  });
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
