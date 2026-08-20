import crypto from "crypto";
import type {
  CheckPaymentResult,
  CreatePaymentParams,
  CreatePaymentResult,
  GatewayTxStatus,
  PaymentGateway,
  RefundResult,
  WebhookProcessResult,
} from "./types";

/**
 * Pasarela simulada para desarrollo/demo sin credenciales reales de Wompi.
 * Genera una URL de "checkout" propia (/pago-simulado/[reservationId]) donde
 * el usuario puede aprobar o rechazar el pago; esa página dispara el mismo
 * endpoint de webhook que usaría la pasarela real, ejercitando el flujo
 * completo (incluida la idempotencia) sin depender de un proveedor externo.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";
  private secret = process.env.QR_SIGNING_SECRET || "mock-secret";
  private baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  private transactions = new Map<
    string,
    { reference: string; amountInCents: number; status: GatewayTxStatus }
  >();

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const providerTxId = `mock_${crypto.randomBytes(8).toString("hex")}`;
    this.transactions.set(providerTxId, {
      reference: params.reference,
      amountInCents: params.amountInCents,
      status: "PENDING",
    });

    return {
      provider: this.name,
      checkoutUrl: `${this.baseUrl}/pago-simulado/${params.reservationId}?txId=${providerTxId}`,
    };
  }

  async checkPayment(providerTxId: string): Promise<CheckPaymentResult> {
    const tx = this.transactions.get(providerTxId);
    return {
      status: tx?.status ?? "PENDING",
      providerTxId,
      reference: tx?.reference ?? "",
      amountInCents: tx?.amountInCents ?? 0,
      raw: tx ?? null,
    };
  }

  async processWebhook(rawBody: string): Promise<WebhookProcessResult> {
    const payload = JSON.parse(rawBody) as {
      providerTxId: string;
      reference: string;
      amountInCents: number;
      status: GatewayTxStatus;
      signature: string;
    };

    const expected = this.sign(payload.providerTxId, payload.status);
    const valid = payload.signature === expected;

    if (valid) {
      const existing = this.transactions.get(payload.providerTxId);
      this.transactions.set(payload.providerTxId, {
        reference: existing?.reference ?? payload.reference,
        amountInCents: existing?.amountInCents ?? payload.amountInCents,
        status: payload.status,
      });
    }

    return {
      valid,
      event: "transaction.updated",
      providerTxId: payload.providerTxId,
      reference: payload.reference,
      status: payload.status,
      amountInCents: payload.amountInCents,
      raw: payload,
    };
  }

  async refundPayment(): Promise<RefundResult> {
    return { success: true, raw: { simulated: true } };
  }

  sign(providerTxId: string, status: string): string {
    return crypto.createHmac("sha256", this.secret).update(`${providerTxId}:${status}`).digest("hex");
  }
}
