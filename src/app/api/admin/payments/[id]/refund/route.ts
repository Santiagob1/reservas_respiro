import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { recordAudit } from "@/server/services/audit.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return fail("PAYMENT_NOT_FOUND", "No encontramos ese pago.", 404);
    if (payment.status !== "APPROVED") {
      return fail("INVALID_PAYMENT_STATE", "Solo se pueden reembolsar pagos aprobados.", 409);
    }

    let raw: unknown = { manual: true };
    if (payment.method === "ONLINE" && payment.providerTxId) {
      const gateway = getPaymentGateway();
      const result = await gateway.refundPayment(payment.providerTxId);
      raw = result.raw;
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { status: "REFUNDED", rawResponse: raw as never },
    });

    await recordAudit({
      adminUserId: admin.id,
      action: "REFUND_PAYMENT",
      entityType: "Payment",
      entityId: id,
      details: { reservationId: payment.reservationId, amount: payment.amount },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
