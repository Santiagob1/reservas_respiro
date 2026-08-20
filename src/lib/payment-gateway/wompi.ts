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
 * Integración con Wompi (https://docs.wompi.co), pasarela colombiana.
 * - Widget/checkout web: script con atributos data-* firmados con la
 *   "signature:integrity" = SHA256(reference + amountInCents + currency + integritySecret).
 * - Consulta de transacción: GET {WOMPI_API_URL}/transactions/{id}.
 * - Webhooks ("eventos"): payload { event, data, signature:{properties, checksum}, timestamp },
 *   checksum = SHA256(valores de las propiedades indicadas, en orden, + timestamp + eventsSecret).
 */
export class WompiGateway implements PaymentGateway {
  readonly name = "wompi";

  private publicKey = requireEnv("WOMPI_PUBLIC_KEY");
  private privateKey = requireEnv("WOMPI_PRIVATE_KEY");
  private integritySecret = requireEnv("WOMPI_INTEGRITY_SECRET");
  private eventsSecret = requireEnv("WOMPI_EVENTS_SECRET");
  private apiUrl = process.env.WOMPI_API_URL || "https://production.wompi.co/v1";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const signatureIntegrity = crypto
      .createHash("sha256")
      .update(`${params.reference}${params.amountInCents}${params.currency}${this.integritySecret}`)
      .digest("hex");

    // Web Checkout de Wompi: redirección GET a checkout.wompi.co/p/ con los
    // parámetros firmados. Más simple de integrar en un flujo SPA que el
    // widget embebido, y documentado como alternativa equivalente.
    const checkoutUrl = new URL("https://checkout.wompi.co/p/");
    checkoutUrl.searchParams.set("public-key", this.publicKey);
    checkoutUrl.searchParams.set("currency", params.currency);
    checkoutUrl.searchParams.set("amount-in-cents", String(params.amountInCents));
    checkoutUrl.searchParams.set("reference", params.reference);
    checkoutUrl.searchParams.set("redirect-url", params.redirectUrl);
    checkoutUrl.searchParams.set("signature:integrity", signatureIntegrity);

    return {
      provider: this.name,
      checkoutUrl: checkoutUrl.toString(),
      widget: {
        publicKey: this.publicKey,
        currency: params.currency,
        amountInCents: params.amountInCents,
        reference: params.reference,
        signatureIntegrity,
        redirectUrl: params.redirectUrl,
        scriptSrc: "https://checkout.wompi.co/widget.js",
      },
    };
  }

  async checkPayment(providerTxId: string): Promise<CheckPaymentResult> {
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/transactions/${providerTxId}`, {
        headers: { Authorization: `Bearer ${this.privateKey}` },
        cache: "no-store",
      });
    } catch {
      throw new PaymentGatewayUnavailableException();
    }

    if (!response.ok) {
      throw new PaymentGatewayUnavailableException();
    }

    const json = (await response.json()) as { data: WompiTransaction };
    const tx = json.data;

    return {
      status: mapStatus(tx.status),
      providerTxId: tx.id,
      reference: tx.reference,
      amountInCents: tx.amount_in_cents,
      raw: tx,
    };
  }

  async processWebhook(rawBody: string, _headers: Headers): Promise<WebhookProcessResult> {
    const payload = JSON.parse(rawBody) as WompiWebhookPayload;

    const valid = this.verifyChecksum(payload);
    const tx = payload.data.transaction;

    return {
      valid,
      event: payload.event,
      providerTxId: tx.id,
      reference: tx.reference,
      status: mapStatus(tx.status),
      amountInCents: tx.amount_in_cents,
      raw: payload,
    };
  }

  private verifyChecksum(payload: WompiWebhookPayload): boolean {
    try {
      const values = payload.signature.properties.map((path) => getByPath(payload.data, path));
      const concatenated = `${values.join("")}${payload.timestamp}${this.eventsSecret}`;
      const expected = crypto.createHash("sha256").update(concatenated).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(payload.signature.checksum.toLowerCase());
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async refundPayment(providerTxId: string): Promise<RefundResult> {
    // Wompi maneja reembolsos vía su API de "refunds" o manualmente desde el
    // dashboard del comercio según el método de pago. Se deja el punto de
    // integración listo; se recomienda confirmar el flujo vigente con Wompi
    // antes de habilitarlo en producción.
    try {
      const response = await fetch(`${this.apiUrl}/transactions/${providerTxId}/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.privateKey}`,
          "Content-Type": "application/json",
        },
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
    throw new Error(`${name} no está configurado. Requerido cuando PAYMENT_PROVIDER=wompi.`);
  }
  return value;
}

function mapStatus(status: string): GatewayTxStatus {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "DECLINED":
      return "DECLINED";
    case "VOIDED":
    case "ERROR":
      return "FAILED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

interface WompiTransaction {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

interface WompiWebhookPayload {
  event: string;
  data: { transaction: WompiTransaction };
  environment: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at: string;
}
