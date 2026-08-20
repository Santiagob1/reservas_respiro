import { z } from "zod";
import { ok, fail, handleApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { MockGateway } from "@/lib/payment-gateway/mock";
import { processGatewayWebhook } from "@/server/services/payment.service";

const schema = z.object({
  reservationId: z.string().min(1),
  txId: z.string().min(1),
  approve: z.boolean(),
});

/**
 * Simula el retorno de la pasarela: construye el mismo evento firmado que
 * enviaría un proveedor real y lo procesa a través del webhook oficial
 * (misma ruta de código, misma idempotencia) — solo el origen es distinto.
 */
export async function POST(req: Request) {
  try {
    const gateway = getPaymentGateway();
    if (gateway.name !== "mock" || !(gateway instanceof MockGateway)) {
      return fail("NOT_FOUND", "No encontrado.", 404);
    }

    const { reservationId, txId, approve } = schema.parse(await req.json());
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) return fail("RESERVATION_NOT_FOUND", "No encontramos esa reserva.", 404);

    const status = approve ? "APPROVED" : "DECLINED";
    const payload = {
      providerTxId: txId,
      reference: reservation.code,
      amountInCents: reservation.totalAmount * 100,
      status,
      signature: gateway.sign(txId, status),
    };

    await processGatewayWebhook(JSON.stringify(payload), new Headers());

    return ok({ code: reservation.code });
  } catch (error) {
    return handleApiError(error);
  }
}
