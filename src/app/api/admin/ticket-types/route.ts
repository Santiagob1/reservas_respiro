import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { createTicketType, listTicketTypes } from "@/server/services/ticket-type.service";
import { recordAudit } from "@/server/services/audit.service";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().int().positive(),
  includes: z.array(z.string()),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const ticketTypes = await listTicketTypes();
    return ok(ticketTypes);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const input = schema.parse(await req.json());
    const ticketType = await createTicketType(input);
    await recordAudit({
      adminUserId: admin.id,
      action: "CREATE_TICKET_TYPE",
      entityType: "TicketType",
      entityId: ticketType.id,
      details: input,
    });
    return ok(ticketType, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
