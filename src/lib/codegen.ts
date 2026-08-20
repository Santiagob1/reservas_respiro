import { customAlphabet } from "nanoid";

// Sin caracteres ambiguos (0/O, 1/I/L) para que se pueda leer y transcribir por WhatsApp.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const nano = customAlphabet(ALPHABET, 5);

/** Genera un código humano único, ej. CIN-8F42K (no expone el ID incremental). */
export function generateReservationCode(): string {
  return `CIN-${nano()}`;
}
