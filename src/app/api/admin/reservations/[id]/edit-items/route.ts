import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { updateReservationItems } from "@/server/services/reservation.service";

const schema = z.object({
  adults: z.number().int().min(0),
  children: z.number().int().min(0),
  items: z.array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  reason: z.string().optional(),
});

/** Ajusta cuántas personas/productos tiene una reserva ya confirmada (ej. llegaron menos de las reservadas). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const body = schema.parse(await req.json());

    const reservation = await updateReservationItems({
      reservationId: id,
      adults: body.adults,
      children: body.children,
      items: body.items,
      adminUserId: admin.id,
      reason: body.reason,
    });

    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
