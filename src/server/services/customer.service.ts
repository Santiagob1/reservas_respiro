import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationException } from "@/server/domain/errors";

export interface CustomerInput {
  fullName: string;
  whatsapp: string;
  email?: string | null;
}

export function validateCustomerInput(input: CustomerInput) {
  if (!input.fullName?.trim() || input.fullName.trim().length < 3) {
    throw new ValidationException("Ingresa tu nombre completo.");
  }
  if (!input.whatsapp?.trim() || !/^\+?\d{7,15}$/.test(input.whatsapp.replace(/\s/g, ""))) {
    throw new ValidationException("Ingresa un número de WhatsApp válido.");
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new ValidationException("Ingresa un correo electrónico válido.");
  }
}

export async function findOrCreateCustomer(
  input: CustomerInput,
  tx: Prisma.TransactionClient = prisma
) {
  validateCustomerInput(input);
  const whatsapp = input.whatsapp.replace(/\s/g, "");

  const existing = await tx.customer.findFirst({ where: { whatsapp } });
  if (existing) {
    if (existing.fullName !== input.fullName || existing.email !== (input.email ?? null)) {
      return tx.customer.update({
        where: { id: existing.id },
        data: { fullName: input.fullName, email: input.email ?? existing.email },
      });
    }
    return existing;
  }

  return tx.customer.create({
    data: { fullName: input.fullName, whatsapp, email: input.email ?? null },
  });
}
