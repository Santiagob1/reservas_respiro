import type { Prisma, TicketType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationException } from "@/server/domain/errors";

export interface ReservationItemInput {
  ticketTypeId: string;
  quantity: number;
}

export interface PricedItem {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PricingResult {
  items: PricedItem[];
  totalAmount: number;
  totalPeople: number;
}

/**
 * Recalcula el total SIEMPRE desde los precios oficiales de base de datos.
 * Nunca confía en precios/cantidades/totales enviados por el frontend
 * (sección 109). Valida que la suma de entradas coincida con adultos+niños.
 */
export async function priceReservationItems(
  itemsInput: ReservationItemInput[],
  adults: number,
  children: number,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PricingResult> {
  if (!itemsInput.length) {
    throw new ValidationException("Selecciona al menos una entrada.");
  }
  if (adults < 0 || children < 0) {
    throw new ValidationException("La cantidad de personas no puede ser negativa.");
  }
  const totalPeople = adults + children;
  if (totalPeople <= 0) {
    throw new ValidationException("Indica cuántas personas asistirán.");
  }

  const ids = itemsInput.map((i) => i.ticketTypeId);
  const ticketTypes = await client.ticketType.findMany({ where: { id: { in: ids } } });
  const byId = new Map<string, TicketType>(ticketTypes.map((t) => [t.id, t]));

  let totalAmount = 0;
  let totalQuantity = 0;
  const items: PricedItem[] = [];

  for (const line of itemsInput) {
    if (line.quantity <= 0) {
      throw new ValidationException("La cantidad de cada entrada debe ser mayor a 0.");
    }
    const ticketType = byId.get(line.ticketTypeId);
    if (!ticketType || !ticketType.active) {
      throw new ValidationException("Uno de los productos seleccionados ya no está disponible.");
    }
    const total = ticketType.price * line.quantity;
    totalAmount += total;
    totalQuantity += line.quantity;
    items.push({
      ticketTypeId: ticketType.id,
      ticketTypeName: ticketType.name,
      quantity: line.quantity,
      unitPrice: ticketType.price,
      total,
    });
  }

  if (totalQuantity !== totalPeople) {
    throw new ValidationException(
      `La cantidad de entradas (${totalQuantity}) debe coincidir con el número de personas (${totalPeople}).`
    );
  }

  return { items, totalAmount, totalPeople };
}
