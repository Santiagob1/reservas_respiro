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
  fullName: string;
  whatsapp: string;
  email: string;
  acceptedTerms: boolean;
}

export const STEP_LABELS = ["Entradas", "Datos", "Pago"] as const;

/** Cada entrada corresponde a una persona: no se pide adultos/niños por separado. */
export function totalPeople(state: WizardState): number {
  return Object.values(state.itemQuantities).reduce((a, b) => a + b, 0);
}

export function calculateTotal(state: WizardState, ticketTypes: TicketTypeDto[]): number {
  return ticketTypes.reduce(
    (sum, t) => sum + (state.itemQuantities[t.id] ?? 0) * t.price,
    0
  );
}

export function formatCOP(amount: number): string {
  return amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}
