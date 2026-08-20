import type { PaymentGateway } from "./types";
import { MockGateway } from "./mock";
import { WompiGateway } from "./wompi";
import { BoldGateway } from "./bold";

const globalForGateway = globalThis as unknown as { paymentGateway?: PaymentGateway };

/**
 * Punto único para obtener la pasarela activa. Seleccionable por
 * PAYMENT_PROVIDER=mock|wompi|bold sin tocar el resto del código (sección 21).
 */
export function getPaymentGateway(): PaymentGateway {
  if (globalForGateway.paymentGateway) return globalForGateway.paymentGateway;

  const provider = process.env.PAYMENT_PROVIDER || "mock";
  let gateway: PaymentGateway;
  if (provider === "wompi") gateway = new WompiGateway();
  else if (provider === "bold") gateway = new BoldGateway();
  else gateway = new MockGateway();

  globalForGateway.paymentGateway = gateway;
  return gateway;
}

export type { PaymentGateway } from "./types";
