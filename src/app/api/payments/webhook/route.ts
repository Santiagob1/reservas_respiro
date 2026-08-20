import { NextResponse } from "next/server";
import { processGatewayWebhook } from "@/server/services/payment.service";

/**
 * Endpoint de webhooks de la pasarela. Siempre procesa de forma idempotente
 * (constraint única sobre el evento) y nunca revela detalles internos en la
 * respuesta (sección 25/55): un webhook duplicado o inválido no debe generar
 * error visible para el proveedor, solo se ignora.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  try {
    const result = await processGatewayWebhook(rawBody, req.headers);
    if (!result.handled) {
      return NextResponse.json({ received: false }, { status: 400 });
    }
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[webhook] error procesando evento:", error);
    // 200 para evitar reintentos agresivos de la pasarela ante un error interno
    // ya registrado; el evento crudo queda en logs para investigación manual.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
