import { ok, handleApiError } from "@/lib/api-response";
import { listTicketTypes } from "@/server/services/ticket-type.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ticketTypes = await listTicketTypes({ onlyActive: true });
    return ok(ticketTypes);
  } catch (error) {
    return handleApiError(error);
  }
}
