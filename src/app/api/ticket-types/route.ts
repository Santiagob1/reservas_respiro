import { ok, handleApiError } from "@/lib/api-response";
import { listTicketTypes } from "@/server/services/ticket-type.service";
import { getEnabledTicketTypesForShowtime } from "@/server/services/showtime.service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const showtimeId = searchParams.get("showtimeId");
    const ticketTypes = showtimeId
      ? await getEnabledTicketTypesForShowtime(showtimeId)
      : await listTicketTypes({ onlyActive: true });
    return ok(ticketTypes);
  } catch (error) {
    return handleApiError(error);
  }
}
