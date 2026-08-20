import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { createReservation, listReservations } from "@/server/services/reservation.service";
import type { ReservationStatus } from "@prisma/client";

const RESERVATION_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_APPROVED",
  "CONFIRMED",
  "CHECKED_IN",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "NO_SHOW",
] as const;

const createSchema = z.object({
  showtimeId: z.string().min(1),
  adults: z.number().int().min(0),
  children: z.number().int().min(0),
  items: z.array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  customer: z.object({
    fullName: z.string().min(3),
    whatsapp: z.string().min(7),
    email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  }),
  source: z.enum(["ADMIN_MANUAL", "WHATSAPP", "PHONE", "WALK_IN"]).default("ADMIN_MANUAL"),
  paymentMethod: z.enum(["ONLINE", "CASH", "BANK_TRANSFER", "OTHER"]),
});

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const status = statusParam
      ? (statusParam.split(",").filter((s) => (RESERVATION_STATUSES as readonly string[]).includes(s)) as ReservationStatus[])
      : undefined;

    const result = await listReservations({
      status,
      showtimeId: searchParams.get("showtimeId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      from: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
      to: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = createSchema.parse(await req.json());

    const reservation = await createReservation({
      showtimeId: body.showtimeId,
      adults: body.adults,
      children: body.children,
      items: body.items,
      customer: body.customer,
      source: body.source,
      paymentMethod: body.paymentMethod,
      adminUserId: admin.id,
    });

    return ok(reservation, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
