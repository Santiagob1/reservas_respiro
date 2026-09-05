import type { PublicShowtimeDto } from "@/server/dto/showtime.dto";

export interface TicketTypeDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  includes: string[];
}

export interface WizardState {
  step: number; // 1..3
  showtime: PublicShowtimeDto | null;
  itemQuantities: Record<string, number>; // ticketTypeId -> quantity
  specialPeopleCount: number; // solo se usa cuando showtime.isSpecial (precio fijo por persona)
  fullName: string;
  whatsapp: string;
  email: string;
  acceptedTerms: boolean;
}

export const STEP_LABELS = ["Entradas", "Datos", "Pago"] as const;

/** Cada entrada corresponde a una persona: no se pide adultos/niños por separado. */
export function totalPeople(state: WizardState): number {
  if (state.showtime?.isSpecial) return state.specialPeopleCount;
  return Object.values(state.itemQuantities).reduce((a, b) => a + b, 0);
}

export function calculateTotal(state: WizardState, ticketTypes: TicketTypeDto[]): number {
  if (state.showtime?.isSpecial) {
    return (state.showtime.specialMenuPrice ?? 0) * state.specialPeopleCount;
  }
  return ticketTypes.reduce(
    (sum, t) => sum + (state.itemQuantities[t.id] ?? 0) * t.price,
    0
  );
}

export interface SummaryLine {
  key: string;
  label: string;
  amount: number;
}

/** Líneas de detalle para mostrar en el resumen (funciones especiales o normales). */
export function getSummaryLines(state: WizardState, ticketTypes: TicketTypeDto[]): SummaryLine[] {
  if (state.showtime?.isSpecial) {
    if (state.specialPeopleCount <= 0) return [];
    return [
      {
        key: "special",
        label: `${state.specialPeopleCount} × Menú especial`,
        amount: (state.showtime.specialMenuPrice ?? 0) * state.specialPeopleCount,
      },
    ];
  }
  return ticketTypes
    .filter((t) => (state.itemQuantities[t.id] ?? 0) > 0)
    .map((t) => ({
      key: t.id,
      label: `${state.itemQuantities[t.id]} × ${t.name}`,
      amount: t.price * (state.itemQuantities[t.id] ?? 0),
    }));
}

export function formatCOP(amount: number): string {
  return amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}
