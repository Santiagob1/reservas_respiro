/**
 * Contrato desacoplado de la pasarela de pago (sección 21). La lógica de
 * negocio (reservation.service, rutas de la API) nunca debe conocer detalles
 * específicos de Wompi u otro proveedor — solo habla con esta interfaz.
 */

export type GatewayTxStatus = "PENDING" | "APPROVED" | "DECLINED" | "FAILED" | "ERROR";

export interface CreatePaymentParams {
  reservationId: string;
  reference: string; // código de reserva, usado como referencia externa
  amountInCents: number;
  currency: string;
  customerEmail?: string;
  redirectUrl: string;
}

export interface CreatePaymentResult {
  provider: string;
  /** Para pasarelas con widget embebido en el navegador (ej. Wompi). */
  widget?: {
    publicKey: string;
    currency: string;
    amountInCents: number;
    reference: string;
    signatureIntegrity: string;
    redirectUrl: string;
    scriptSrc: string;
  };
  /** Para pasarelas/flows con checkout propio o de redirección directa. */
  checkoutUrl?: string;
}

export interface CheckPaymentResult {
  status: GatewayTxStatus;
  providerTxId: string;
  reference: string;
  amountInCents: number;
  raw: unknown;
}

export interface WebhookProcessResult {
  valid: boolean;
  event: string;
  providerTxId: string;
  reference: string;
  status: GatewayTxStatus;
  amountInCents: number;
  raw: unknown;
}

export interface RefundResult {
  success: boolean;
  raw: unknown;
}

export interface PaymentGateway {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  checkPayment(providerTxId: string): Promise<CheckPaymentResult>;
  processWebhook(rawBody: string, headers: Headers): Promise<WebhookProcessResult>;
  refundPayment(providerTxId: string): Promise<RefundResult>;
}
