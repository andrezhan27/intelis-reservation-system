import "server-only";

type N8nResponseBody = {
  success?: boolean;
  code?: unknown;
  status?: unknown;
};

export type N8nManagementResult =
  | { ok: true }
  | { ok: false; reason: "configuration" | "unavailable" | "failure" };

export async function callManagementWebhook(
  webhookEnvironmentVariable:
    | "N8N_MODIFY_BOOKING_WEBHOOK_URL"
    | "N8N_CANCEL_BOOKING_WEBHOOK_URL",
  payload: Record<string, unknown>
): Promise<N8nManagementResult> {
  const webhookUrl = process.env[webhookEnvironmentVariable];
  const internalApiKey = process.env.N8N_INTERNAL_API_KEY;

  if (!webhookUrl || !internalApiKey) {
    return { ok: false, reason: "configuration" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": internalApiKey
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const body = await parseResponse(response);

    if (isUnavailableResponse(response.status, body)) {
      return { ok: false, reason: "unavailable" };
    }

    if (!response.ok || body?.success === false) {
      console.error("A booking management webhook returned an error", {
        webhook: webhookEnvironmentVariable,
        status: response.status,
        code: normalizeField(body?.code),
        responseStatus: normalizeField(body?.status)
      });

      return { ok: false, reason: "failure" };
    }

    return { ok: true };
  } catch (error) {
    console.error("A booking management webhook request failed", {
      webhook: webhookEnvironmentVariable,
      error: error instanceof Error ? error.name : "Unknown error"
    });

    return { ok: false, reason: "failure" };
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as N8nResponseBody;
  } catch {
    return null;
  }
}

function isUnavailableResponse(status: number, body: N8nResponseBody | null) {
  const code = normalizeField(body?.code);
  const responseStatus = normalizeField(body?.status);

  return status === 409 || code === "UNAVAILABLE" || responseStatus === "UNAVAILABLE";
}

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : undefined;
}
