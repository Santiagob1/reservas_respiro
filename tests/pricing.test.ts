import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { priceReservationItems } from "@/server/services/pricing.service";
import { ValidationException } from "@/server/domain/errors";
import { createTestTicketType, cleanupTicketType } from "./helpers";

describe("pricing.service", () => {
  let general: Awaited<ReturnType<typeof createTestTicketType>>;
  let combo: Awaited<ReturnType<typeof createTestTicketType>>;

  beforeAll(async () => {
    general = await createTestTicketType(15000);
    combo = await createTestTicketType(30000);
  });

  afterAll(async () => {
    await cleanupTicketType(general.id);
    await cleanupTicketType(combo.id);
  });

  it("calcula el total desde el precio oficial en base de datos, no desde el cliente", async () => {
    const result = await priceReservationItems(
      [
        { ticketTypeId: general.id, quantity: 2 },
        { ticketTypeId: combo.id, quantity: 1 },
      ],
      2,
      1
    );
    expect(result.totalAmount).toBe(2 * 15000 + 30000);
    expect(result.totalPeople).toBe(3);
  });

  it("rechaza cuando la cantidad de entradas no coincide con las personas", async () => {
    await expect(
      priceReservationItems([{ ticketTypeId: general.id, quantity: 1 }], 2, 0)
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it("rechaza cantidades en 0 o negativas", async () => {
    await expect(
      priceReservationItems([{ ticketTypeId: general.id, quantity: 0 }], 0, 0)
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it("nunca usa un precio distinto al almacenado, aunque el llamador intente forzarlo", async () => {
    const result = await priceReservationItems([{ ticketTypeId: general.id, quantity: 1 }], 1, 0);
    expect(result.items[0].unitPrice).toBe(15000);
  });
});
