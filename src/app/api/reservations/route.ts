import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { createReservation } from "@/server/services/reservation.service";

const bodySchema = z.object({
  showtimeId: z.string().min(1),
  adults: z.number().int().min(0),
  children: z.number().int().min(0),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  customer: z.object({
    fullName: z.string().min(3),
    whatsapp: z.string().min(7),
    email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  }),
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, "Debes aceptar los términos y las políticas para continuar."),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    const reservation = await createReservation({
      showtimeId: body.showtimeId,
      adults: body.adults,
      children: body.children,
      items: body.items,
      customer: body.customer,
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    return ok(
      {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        totalAmount: reservation.totalAmount,
        expiresAt: reservation.expiresAt,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
