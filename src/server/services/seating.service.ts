import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { now } from "@/lib/timezone";
import { getSetting } from "@/server/services/settings.service";

/**
 * Motor de asignación de asientos por módulos físicos (sección "particularidades
 * del cine"). La sala NO tiene cupos genéricos: tiene sofás fijos.
 *
 *  - 4 módulos "pareja" (1.50m) — capacidad base 2 personas.
 *  - 2 módulos "trío" (2.00m) — capacidad base 3 personas.
 *  - N piezas auxiliares (0.50m, Setting `auxiliary_module_count`, por
 *    defecto 2) — cada una se pega a UN módulo para sumarle +1 persona.
 *    Nunca forman un asiento independiente.
 *
 * Capacidad física: base 4×2 + 2×3 = 14 personas. Con las auxiliares al
 * máximo: 14 + 2 = 16. Pero esos 16 solo se alcanzan si las reservas se
 * empacan bien — de ahí el algoritmo de empaque de abajo.
 *
 * Cada reserva ocupa uno o más módulos completos (nunca comparte un módulo
 * con otra reserva). Al crear una reserva se busca la combinación de
 * módulos libres (+ auxiliares restantes) que:
 *   1. Alcance el tamaño del grupo (obligatorio).
 *   2. Use el menor número de módulos posible (el grupo queda junto; ej.
 *      un grupo de 3 sin tríos libres ocupa UN módulo pareja + auxiliar,
 *      no dos módulos pareja separados).
 *   3. Dentro de esa cantidad mínima de módulos, gaste el menor número de
 *      auxiliares posible (son el recurso más escaso: solo hay 2, y de
 *      ellas depende poder llegar a 16 en vez de quedarse en 14).
 *   4. Desperdicie el menor número de sillas posible.
 */

type Client = typeof prisma | Prisma.TransactionClient;

export interface FreeModule {
  id: string;
  type: "COUPLE" | "TRIO";
  baseCapacity: number;
}

export interface SeatingPlanItem {
  venueModuleId: string;
  seatsOccupied: number;
  usesAuxiliary: boolean;
}

export interface ShowtimeSeatingState {
  physicalMax: number; // capacidad máxima teórica de la sala (todas las auxiliares en uso)
  physicalBase: number; // capacidad sin usar ninguna auxiliar
  occupiedSeats: number; // personas ya sentadas (reservas activas) en esta función
  freeModules: FreeModule[];
  remainingAux: number;
}

export async function getActiveVenueModules(client: Client = prisma) {
  return client.venueModule.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getPhysicalRoomCapacity(client: Client = prisma): Promise<{ base: number; max: number }> {
  const [modules, auxCount] = await Promise.all([
    getActiveVenueModules(client),
    getSetting("auxiliary_module_count"),
  ]);
  const base = modules.reduce((sum, m) => sum + m.baseCapacity, 0);
  return { base, max: base + auxCount };
}

export async function getShowtimeSeatingState(
  showtimeId: string,
  client: Client = prisma
): Promise<ShowtimeSeatingState> {
  const [modules, auxCount, assignments] = await Promise.all([
    getActiveVenueModules(client),
    getSetting("auxiliary_module_count"),
    client.reservationModuleAssignment.findMany({
      where: {
        reservation: {
          showtimeId,
          OR: [
            { status: { in: ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"] } },
            { status: "PENDING_PAYMENT", expiresAt: null },
            { status: "PENDING_PAYMENT", expiresAt: { gt: now() } },
          ],
        },
      },
      select: { venueModuleId: true, seatsOccupied: true, usesAuxiliary: true },
    }),
  ]);

  const occupiedModuleIds = new Set(assignments.map((a) => a.venueModuleId));
  const occupiedSeats = assignments.reduce((sum, a) => sum + a.seatsOccupied, 0);
  const usedAux = assignments.filter((a) => a.usesAuxiliary).length;

  const physicalBase = modules.reduce((sum, m) => sum + m.baseCapacity, 0);
  const physicalMax = physicalBase + auxCount;

  const freeModules: FreeModule[] = modules
    .filter((m) => !occupiedModuleIds.has(m.id))
    .map((m) => ({ id: m.id, type: m.type, baseCapacity: m.baseCapacity }));

  return {
    physicalMax,
    physicalBase,
    occupiedSeats,
    freeModules,
    remainingAux: Math.max(0, auxCount - usedAux),
  };
}

export interface ShowtimeSeatingModuleDetail {
  id: string;
  label: string;
  type: "COUPLE" | "TRIO";
  baseCapacity: number;
  occupied: boolean;
  seatsOccupied: number | null;
  usesAuxiliary: boolean;
  reservation: { code: string; customerName: string; status: string } | null;
}

/** Vista completa (para el panel admin) de qué reserva ocupa cada módulo en una función. */
export async function getShowtimeSeatingDetail(
  showtimeId: string,
  client: Client = prisma
): Promise<{ modules: ShowtimeSeatingModuleDetail[]; remainingAux: number; auxCount: number }> {
  const [modules, auxCount, assignments] = await Promise.all([
    getActiveVenueModules(client),
    getSetting("auxiliary_module_count"),
    client.reservationModuleAssignment.findMany({
      where: {
        reservation: {
          showtimeId,
          OR: [
            { status: { in: ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"] } },
            { status: "PENDING_PAYMENT", expiresAt: null },
            { status: "PENDING_PAYMENT", expiresAt: { gt: now() } },
          ],
        },
      },
      include: { reservation: { include: { customer: true } } },
    }),
  ]);

  const byModuleId = new Map(assignments.map((a) => [a.venueModuleId, a]));
  const usedAux = assignments.filter((a) => a.usesAuxiliary).length;

  const detail: ShowtimeSeatingModuleDetail[] = modules.map((m) => {
    const assignment = byModuleId.get(m.id);
    return {
      id: m.id,
      label: m.label,
      type: m.type,
      baseCapacity: m.baseCapacity,
      occupied: Boolean(assignment),
      seatsOccupied: assignment?.seatsOccupied ?? null,
      usesAuxiliary: assignment?.usesAuxiliary ?? false,
      reservation: assignment
        ? {
            code: assignment.reservation.code,
            customerName: assignment.reservation.customer.fullName,
            status: assignment.reservation.status,
          }
        : null,
    };
  });

  return { modules: detail, remainingAux: Math.max(0, auxCount - usedAux), auxCount };
}

/**
 * Busca la mejor combinación de módulos libres (+ auxiliares) para sentar a
 * `partySize` personas juntas. Explora todas las combinaciones posibles (el
 * número de módulos es pequeño, es barato hacerlo exhaustivo) y elige, en
 * este orden de prioridad: menos módulos > menos auxiliares > menos sillas
 * desperdiciadas. Devuelve `null` si el grupo no cabe con lo que queda libre.
 */
export function findSeatingPlan(
  freeModules: FreeModule[],
  remainingAux: number,
  partySize: number
): SeatingPlanItem[] | null {
  if (partySize <= 0) return [];

  const n = freeModules.length;
  let best: { indices: number[]; auxUsed: number; waste: number } | null = null;

  const totalCombinations = 1 << n;
  for (let mask = 1; mask < totalCombinations; mask++) {
    const indices: number[] = [];
    let baseSum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        indices.push(i);
        baseSum += freeModules[i].baseCapacity;
      }
    }

    const maxAuxForSubset = Math.min(remainingAux, indices.length);
    for (let auxUsed = 0; auxUsed <= maxAuxForSubset; auxUsed++) {
      const totalCapacity = baseSum + auxUsed;
      if (totalCapacity < partySize) continue;

      const waste = totalCapacity - partySize;
      const isBetter =
        !best ||
        indices.length < best.indices.length ||
        (indices.length === best.indices.length && auxUsed < best.auxUsed) ||
        (indices.length === best.indices.length && auxUsed === best.auxUsed && waste < best.waste);

      if (isBetter) best = { indices, auxUsed, waste };
      break; // más auxiliares que el mínimo necesario para este subconjunto nunca ayuda
    }
  }

  if (!best) return null;

  return best.indices.map((i, position) => {
    const module = freeModules[i];
    const usesAuxiliary = position < best!.auxUsed;
    return {
      venueModuleId: module.id,
      seatsOccupied: module.baseCapacity + (usesAuxiliary ? 1 : 0),
      usesAuxiliary,
    };
  });
}
