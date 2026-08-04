import { NextResponse } from "next/server";
import { getCapacityAvailability } from "@/lib/capacityAvailability";
import { getRestaurantSettings } from "@/lib/restaurants";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const restaurantSlug = searchParams.get("restaurant_slug")?.trim() || "";
  const date = searchParams.get("date")?.trim() || "";
  const partySize = Number(searchParams.get("party_size"));

  if (!restaurantSlug || !date || !Number.isInteger(partySize) || partySize < 1) {
    return json({ success: false, message: "Invalid availability request." }, 400);
  }

  const settings = await getRestaurantSettings(restaurantSlug);

  if (!settings) {
    return json({ success: false, message: "Restaurant not found." }, 404);
  }

  const result = await getCapacityAvailability(
    settings.restaurant_id,
    date,
    partySize
  );

  if (!result.ok) {
    return json({ success: false, message: "Availability could not be checked." }, 503);
  }

  return json({ success: true, meal_periods: result.mealPeriods }, 200);
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
