import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { updateTicketType, setTicketTypeActive } from "@/server/services/ticket-type.service";
import { recordAudit } from "@/server/services/audit.service";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().int().positive().optional(),
  includes: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const body = schema.parse(await req.json());

    let ticketType;
    if (typeof body.active === "boolean") {
      ticketType = await setTicketTypeActive(id, body.active);
    }
    const rest = { ...body };
    delete rest.active;
    if (Object.keys(rest).length > 0) {
      ticketType = await updateTicketType(id, rest);
    }

    await recordAudit({
      adminUserId: admin.id,
      action: "UPDATE_TICKET_TYPE",
      entityType: "TicketType",
      entityId: id,
      details: body,
    });

    return ok(ticketType);
  } catch (error) {
    return handleApiError(error);
  }
}
