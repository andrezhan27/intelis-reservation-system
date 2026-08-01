import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  canModifyBooking,
  loadManagementBooking
} from "@/lib/manageBooking";
import {
  createChangeSummary,
  validateManageBookingUpdate
} from "@/lib/manageBookingValidation";
import { callManagementWebhook } from "@/lib/n8nManagement";
import { getRestaurantSettings } from "@/lib/restaurants";
import {
  formatDateValue,
  isPastDateValue,
  isReservationTimeAvailable
} from "@/lib/reservationAvailability";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const genericErrorMessage =
  "Não foi possível alterar a reserva. Tente novamente ou contacte o restaurante.";
const unavailableMessage =
  "O horário selecionado não está disponível. Escolha outro horário.";

export async function PATCH(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const lookup = await loadManagementBooking(token);

  if (!lookup.ok) {
    return json(
      { success: false, message: genericErrorMessage },
      { status: lookup.reason === "configuration" ? 500 : 404 }
    );
  }

  const { booking, restaurant } = lookup.context;

  if (!canModifyBooking(booking.status)) {
    return json(
      { success: false, message: "Esta reserva já não pode ser alterada." },
      { status: 409 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, message: "Verifique os dados e tente novamente." },
      { status: 400 }
    );
  }

  const settings = await getRestaurantSettings(restaurant.slug);
  const validation = validateManageBookingUpdate(
    body,
    booking,
    settings?.max_party_size ?? null
  );

  if (!validation.ok) {
    return json(
      {
        success: false,
        message: "Verifique os dados e tente novamente.",
        errors: validation.errors
      },
      { status: 400 }
    );
  }

  if (Object.keys(validation.changes).length === 0) {
    return json({
      success: true,
      pending: false,
      message: "Não existem alterações para guardar."
    });
  }

  if (
    validation.proposed.date !== booking.date ||
    validation.proposed.time !== booking.time
  ) {
    const today = formatDateValue(new Date());

    if (
      !settings ||
      isPastDateValue(validation.proposed.date, today) ||
      !isReservationTimeAvailable(
        validation.proposed.date,
        validation.proposed.time,
        settings,
        new Date()
      )
    ) {
      return json(
        {
          success: false,
          code: "UNAVAILABLE",
          message: unavailableMessage
        },
        { status: 409 }
      );
    }
  }

  const requestedAt = new Date().toISOString();
  const requestId = randomUUID();
  const idempotencyKey = createIdempotencyKey(
    booking.reservation_id,
    booking.updated_at,
    validation.proposed
  );
  const result = await callManagementWebhook("N8N_MODIFY_BOOKING_WEBHOOK_URL", {
    event: "CUSTOMER_RESERVATION_MODIFICATION_REQUESTED",
    request_id: requestId,
    idempotency_key: idempotencyKey,
    requested_at: requestedAt,
    reservation_id: booking.reservation_id,
    restaurant_id: booking.restaurant_id,
    require_confirmation: restaurant.require_confirmation,
    original: {
      date: booking.date,
      time: booking.time,
      party_size: booking.party_size,
      special_requests: booking.special_requests,
      status: booking.status
    },
    changes: validation.changes,
    proposed: validation.proposed,
    change_summary: createChangeSummary(validation.changes)
  });

  if (!result.ok) {
    if (result.reason === "unavailable") {
      return json(
        { success: false, code: "UNAVAILABLE", message: unavailableMessage },
        { status: 409 }
      );
    }

    return json({ success: false, message: genericErrorMessage }, { status: 500 });
  }

  return json({
    success: true,
    pending: restaurant.require_confirmation,
    message: restaurant.require_confirmation
      ? "O pedido de alteração foi enviado ao restaurante para confirmação."
      : "A reserva foi alterada com sucesso."
  });
}

function createIdempotencyKey(
  reservationId: string,
  updatedAt: string | null,
  proposed: Record<string, unknown>
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation: "MODIFY",
        reservation_id: reservationId,
        booking_version: updatedAt,
        proposed
      })
    )
    .digest("hex");
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
