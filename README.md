# Restaurant Reservation Widget

Reusable iframe-friendly reservation widget for restaurant websites.

## Routes

Each restaurant is loaded by slug:

```txt
https://reservations.intelis.pt/starwok
https://reservations.intelis.pt/okira
https://reservations.intelis.pt/wokking
```

Example embed:

```html
<iframe
  src="https://reservations.intelis.pt/starwok"
  width="100%"
  height="700"
  style="border:0; border-radius:16px;"
></iframe>
```

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
N8N_RESERVATION_WEBHOOK_URL=https://your-n8n-domain.com/webhook/reservation-request
```

Only the Supabase anon key is used by the app to read public restaurant settings from the `restaurants` table. Reservation submissions go through `/api/reservations`, which forwards validated payloads to n8n using the private `N8N_RESERVATION_WEBHOOK_URL`.

For local one-off testing, n8n test URLs usually look like `/webhook-test/...` and only work while the workflow is actively listening for a test event. For normal widget submissions, use the production `/webhook/...` URL and activate the n8n workflow.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000/starwok` after running the RLS policy in `supabase/schema.sql` and adding a matching restaurant row in Supabase.

## Reservation Flow

1. Customer opens `/:restaurantSlug` in an iframe.
2. The page reads public restaurant settings from Supabase.
3. The form posts to `/api/reservations`.
4. The API validates input, adds consent timestamps/source fields, normalizes `phone` to `phone_number`, and forwards the payload to n8n.
5. n8n handles availability, pending booking creation, emails, and calendar actions.

The widget does not create confirmed reservations directly.

## API Responses

Validation errors return HTTP 400:

```json
{
  "success": false,
  "message": "Please check the reservation details and try again."
}
```

Successful n8n submissions return:

```json
{
  "success": true,
  "message": "Your reservation request has been received. It is not confirmed yet. The restaurant will review it and contact you shortly."
}
```

If n8n reports unavailable, the API returns:

```json
{
  "success": false,
  "code": "UNAVAILABLE",
  "message": "This time may not be available. Please choose another time or contact the restaurant directly."
}
```
