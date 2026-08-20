import crypto from "crypto";
import { PaymentGatewayUnavailableException } from "@/server/domain/errors";
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
 * Integración con Bold (https://developers.bold.co), pasarela colombiana.
 *
 * - Link de pagos: POST {BOLD_API_URL}/online/link/v1 — el checkout alojado
 *   por Bold ofrece tarjeta, PSE, Nequi y, si la cuenta tiene "QR Pro"
 *   activado, también QR Bre-B (pago instantáneo interoperable entre
 *   bancos) sin integración adicional de nuestro lado.
 * - Verificación de transacción: GET {BOLD_VOUCHER_API_URL}/payment-voucher/{id}.
 * - Webhooks: payload tipo CloudEvents, firma HMAC-SHA256 sobre el body en
 *   base64, comparada contra el header `x-bold-signature`.
 *
 * ⚠️ La documentación de Bold está fragmentada entre varios productos
 * (Link de Pagos, Botón de Pagos, API de Pagos en Línea). Antes de operar en
 * producción, valida el endpoint de consulta de transacción y los nombres de
 * campo del webhook contra el sandbox real de tu cuenta Bold — ver
 * https://developers.bold.co/pagos-en-linea/consulta-de-transacciones y
 * https://developers.bold.co/webhook.
 */
export class BoldGateway implements PaymentGateway {
  readonly name = "bold";

  private apiKey = requireEnv("BOLD_API_KEY");
  private webhookSecret = requireEnv("BOLD_WEBHOOK_SECRET");
  private apiUrl = process.env.BOLD_API_URL || "https://integrations.api.bold.co";
  private voucherApiUrl = process.env.BOLD_VOUCHER_API_URL || "https://payments.api.bold.co/v2";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/online/link/v1`, {
        method: "POST",
        headers: {
          Authorization: `x-api-key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_type: "CLOSE",
          amount: {
            currency: params.currency,
            total_amount: params.amountInCents,
            tip_amount: 0,
          },
          reference: params.reference,
          description: `Reserva ${params.reference} — Cine Respiro`,
          callback_url: params.redirectUrl,
        }),
      });
    } catch {
      throw new PaymentGatewayUnavailableException();
    }

    if (!response.ok) {
      throw new PaymentGatewayUnavailableException();
    }

    const json = (await response.json()) as {
      payload?: { payment_link?: string; url?: string };
      data?: { payment_link?: string; url?: string };
      url?: string;
    };
    const checkoutUrl = json.payload?.url ?? json.data?.url ?? json.url;
    if (!checkoutUrl) {
      throw new PaymentGatewayUnavailableException();
    }

    return { provider: this.name, checkoutUrl };
  }

  async checkPayment(providerTxId: string): Promise<CheckPaymentResult> {
    let response: Response;
    try {
      response = await fetch(`${this.voucherApiUrl}/payment-voucher/${providerTxId}`, {
        headers: { Authorization: `x-api-key ${this.apiKey}` },
        cache: "no-store",
      });
    } catch {
      throw new PaymentGatewayUnavailableException();
    }

    if (!response.ok) {
      throw new PaymentGatewayUnavailableException();
    }

    const tx = (await response.json()) as BoldVoucher;

    return {
      status: mapStatus(tx.payment_status),
      providerTxId: tx.transaction_id ?? providerTxId,
      reference: tx.reference_id ?? tx.reference ?? "",
      amountInCents: tx.amount?.total_amount ?? 0,
      raw: tx,
    };
  }

  async processWebhook(rawBody: string, headers: Headers): Promise<WebhookProcessResult> {
    const signature = headers.get("x-bold-signature") ?? "";
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(Buffer.from(rawBody).toString("base64"))
      .digest("hex");

    const valid =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    const event = JSON.parse(rawBody) as BoldWebhookEvent;
    const data = event.data ?? {};
    const reference = data.reference ?? data.metadata?.reference ?? data.order?.reference ?? "";
    const providerTxId = data.payment_id ?? event.subject ?? "";
    const amountInCents = data.amount?.total_amount ?? 0;

    return {
      valid,
      event: event.type ?? "unknown",
      providerTxId,
      reference,
      status: mapEventType(event.type),
      amountInCents,
      raw: event,
    };
  }

  async refundPayment(providerTxId: string): Promise<RefundResult> {
    try {
      const response = await fetch(`${this.apiUrl}/online/payment/void`, {
        method: "POST",
        headers: {
          Authorization: `x-api-key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payment_id: providerTxId }),
      });
      const raw = await response.json().catch(() => null);
      return { success: response.ok, raw };
    } catch {
      throw new PaymentGatewayUnavailableException();
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no está configurado. Requerido cuando PAYMENT_PROVIDER=bold.`);
  }
  return value;
}

function mapStatus(status?: string): GatewayTxStatus {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
    case "DECLINED":
      return "DECLINED";
    case "FAILED":
    case "ERROR":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function mapEventType(type?: string): GatewayTxStatus {
  switch (type) {
    case "SALE_APPROVED":
      return "APPROVED";
    case "SALE_REJECTED":
      return "DECLINED";
    default:
      return "PENDING";
  }
}

interface BoldVoucher {
  transaction_id?: string;
  reference_id?: string;
  reference?: string;
  payment_status?: string;
  amount?: { total_amount?: number; currency?: string };
}

interface BoldWebhookEvent {
  id?: string;
  type?: string; // SALE_APPROVED | SALE_REJECTED | VOID_APPROVED | VOID_REJECTED
  subject?: string; // transaction id
  time?: string;
  source?: string;
  data?: {
    payment_id?: string;
    reference?: string;
    metadata?: { reference?: string };
    order?: { reference?: string };
    amount?: { total_amount?: number; currency?: string };
  };
}
