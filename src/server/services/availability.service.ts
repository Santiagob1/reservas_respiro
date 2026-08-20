import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { now } from "@/lib/timezone";

export interface AvailabilitySnapshot {
  capacity: number;
  confirmed: number; // PAYMENT_APPROVED + CONFIRMED + CHECKED_IN
  pending: number; // PENDING_PAYMENT no expirado
  available: number;
}

const CONFIRMED_STATUSES = ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"] as const;

type Client = typeof prisma | Prisma.TransactionClient;

/**
 * Bloquea la fila de la función (SELECT ... FOR UPDATE) para serializar
 * cualquier operación concurrente que afecte su disponibilidad. Debe usarse
 * siempre dentro de una transacción antes de leer/escribir reservas de esa función.
 */
export async function lockShowtimeForUpdate(tx: Prisma.TransactionClient, showtimeId: string) {
  const rows = await tx.$queryRaw<{ id: string; capacity: number }[]>`
    SELECT id, capacity FROM showtimes WHERE id = ${showtimeId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function getShowtimeAvailability(
  showtimeId: string,
  client: Client = prisma
): Promise<AvailabilitySnapshot> {
  const showtime = await client.showtime.findUnique({
    where: { id: showtimeId },
    select: { capacity: true },
  });
  if (!showtime) {
    return { capacity: 0, confirmed: 0, pending: 0, available: 0 };
  }

  const [confirmedAgg, pendingAgg] = await Promise.all([
    client.reservation.aggregate({
      where: {
        showtimeId,
        status: { in: [...CONFIRMED_STATUSES] },
      },
      _sum: { adults: true, children: true },
    }),
    client.reservation.aggregate({
      where: {
        showtimeId,
        status: "PENDING_PAYMENT",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
      },
      _sum: { adults: true, children: true },
    }),
  ]);

  const confirmed = (confirmedAgg._sum.adults ?? 0) + (confirmedAgg._sum.children ?? 0);
  const pending = (pendingAgg._sum.adults ?? 0) + (pendingAgg._sum.children ?? 0);
  const available = Math.max(0, showtime.capacity - confirmed - pending);

  return { capacity: showtime.capacity, confirmed, pending, available };
}

export async function getAvailabilityForShowtimes(
  showtimeIds: string[]
): Promise<Record<string, AvailabilitySnapshot>> {
  const entries = await Promise.all(
    showtimeIds.map(async (id) => [id, await getShowtimeAvailability(id)] as const)
  );
  return Object.fromEntries(entries);
}
