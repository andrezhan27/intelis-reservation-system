# n8n booking management contracts

The customer browser never calls these webhooks. It calls the Next.js API, and
Next.js forwards a server-generated payload to n8n with this header:

```http
X-Internal-API-Key: <N8N_INTERNAL_API_KEY>
```

Configure Header Auth on all three n8n Webhook nodes using the same value as the
Next.js `N8N_INTERNAL_API_KEY` environment variable.

## Modify booking

Environment variable:

```text
N8N_MODIFY_BOOKING_WEBHOOK_URL
```

Next.js sends a `POST` request resembling:

```json
{
  "event": "CUSTOMER_RESERVATION_MODIFICATION_REQUESTED",
  "request_id": "018f...",
  "idempotency_key": "sha256...",
  "requested_at": "2026-08-01T12:00:00.000Z",
  "reservation_id": "RES-123",
  "restaurant_id": "restaurant-id",
  "require_confirmation": true,
  "original": {
    "name": "Alex Smith",
    "date": "2026-08-20",
    "time": "19:30",
    "party_size": 2,
    "special_requests": "Window table",
    "status": "CONFIRMED"
  },
  "changes": {
    "date": "2026-08-21",
    "party_size": 4
  },
  "proposed": {
    "date": "2026-08-21",
    "time": "19:30",
    "party_size": 4,
    "special_requests": "Window table"
  },
  "change_summary": [
    "date: 2026-08-21",
    "party size: 4"
  ]
}
```

`reservation_id`, `restaurant_id`, `original`, `require_confirmation`, and
`change_summary` are generated server-side. The browser cannot provide them.

Recommended workflow behavior:

1. Reject requests whose internal API key is invalid.
2. Use `idempotency_key` to return the saved result for duplicate requests.
3. Load the booking by `reservation_id` and confirm its restaurant and status.
4. Insert a row in `reservation_change_requests`.
5. If `require_confirmation` is `true`, use status `PENDING` and leave the
   booking unchanged for dashboard approval.
6. Otherwise apply `proposed`, keep the booking `CONFIRMED`, and mark the change
   request `APPLIED`.
7. Update calendar data and other downstream systems when the booking is applied.

Successful response:

```json
{ "success": true }
```

Unavailable response:

```json
{ "success": false, "code": "UNAVAILABLE" }
```

Return HTTP `409` for unavailable times. Other workflow failures should return a
non-2xx response without secrets or raw provider errors.

## Cancel booking

Environment variable:

```text
N8N_CANCEL_BOOKING_WEBHOOK_URL
```

Next.js sends a `POST` request resembling:

```json
{
  "event": "CUSTOMER_RESERVATION_CANCELLATION_REQUESTED",
  "request_id": "018f...",
  "idempotency_key": "sha256...",
  "requested_at": "2026-08-01T12:00:00.000Z",
  "reservation_id": "RES-123",
  "restaurant_id": "restaurant-id",
  "original": {
    "name": "Alex Smith",
    "date": "2026-08-20",
    "time": "19:30",
    "party_size": 2,
    "special_requests": "Window table",
    "status": "CONFIRMED"
  }
}
```

Recommended workflow behavior:

1. Reject invalid internal API keys.
2. Treat duplicate `idempotency_key` values as successful retries.
3. Load and validate the booking.
4. If already cancelled, return success without repeating side effects.
5. Set `bookings.status` to `CANCELLED`.
6. Insert an `APPLIED` cancellation row in `reservation_change_requests`.
7. Cancel or remove associated calendar data and other downstream records.

Successful response:

```json
{ "success": true }
```

## Confirmation email links

The initial reservation workflow generates a cryptographically random
`customer_management_token`, stores it on the new booking, and uses the
restaurant slug to build these links:

```text
https://reservations.example.com/{restaurantSlug}/manage/{token}?action=modify
https://reservations.example.com/{restaurantSlug}/manage/{token}?action=cancel
```

The cancellation link only opens a confirmation screen. It must never cancel a
booking from a `GET` request.
