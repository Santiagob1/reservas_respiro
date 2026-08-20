import { prisma } from "@/lib/prisma";
import { ValidationException } from "@/server/domain/errors";

export interface TicketTypeInput {
  name: string;
  description?: string | null;
  price: number;
  includes: string[];
  sortOrder?: number;
}

export async function listTicketTypes(opts: { onlyActive?: boolean } = {}) {
  return prisma.ticketType.findMany({
    where: opts.onlyActive ? { active: true } : undefined,
    orderBy: { sortOrder: "asc" },
  });
}

export async function createTicketType(input: TicketTypeInput) {
  validate(input);
  return prisma.ticketType.create({ data: input });
}

export async function updateTicketType(id: string, input: Partial<TicketTypeInput>) {
  if (input.price !== undefined && input.price <= 0) {
    throw new ValidationException("El precio debe ser mayor a 0.");
  }
  return prisma.ticketType.update({ where: { id }, data: input });
}

export async function setTicketTypeActive(id: string, active: boolean) {
  return prisma.ticketType.update({ where: { id }, data: { active } });
}

function validate(input: TicketTypeInput) {
  if (!input.name?.trim()) throw new ValidationException("El nombre del producto es obligatorio.");
  if (!input.price || input.price <= 0) throw new ValidationException("El precio debe ser mayor a 0.");
}
