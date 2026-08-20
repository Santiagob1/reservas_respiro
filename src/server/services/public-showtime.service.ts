import { listShowtimes } from "@/server/services/showtime.service";
import { getAvailabilityForShowtimes } from "@/server/services/availability.service";
import { getSetting } from "@/server/services/settings.service";
import { toPublicShowtimeDto, type PublicShowtimeDto } from "@/server/dto/showtime.dto";
import { now } from "@/lib/timezone";

export async function listPublicShowtimes(): Promise<PublicShowtimeDto[]> {
  const showtimes = await listShowtimes({ publicOnly: true, from: now() });
  const availabilityMap = await getAvailabilityForShowtimes(showtimes.map((s) => s.id));
  const lowThreshold = await getSetting("low_availability_threshold");
  return showtimes.map((s) => toPublicShowtimeDto(s, availabilityMap[s.id], lowThreshold));
}
