import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function recordAudit(params: {
  adminUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  await client.auditLog.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details as Prisma.InputJsonValue,
    },
  });
}
