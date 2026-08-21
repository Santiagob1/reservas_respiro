import { ok, handleApiError, fail } from "@/lib/api-response";
import { getShowtimeById } from "@/server/services/showtime.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { toPublicShowtimeDto } from "@/server/dto/showtime.dto";
import { getSetting } from "@/server/services/settings.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const showtime = await getShowtimeById(id);
    if (showtime.status !== "PUBLISHED") {
      return fail("SHOWTIME_NOT_AVAILABLE", "Esta función no está disponible para reservar.", 404);
    }
    const availability = await getShowtimeAvailability(id);
    const lowThreshold = await getSetting("low_availability_threshold");
    return ok(toPublicShowtimeDto(showtime, availability, lowThreshold));
  } catch (error) {
    return handleApiError(error);
  }
}
