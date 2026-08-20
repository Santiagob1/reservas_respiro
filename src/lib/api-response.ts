import { NextResponse } from "next/server";
import { DomainError } from "@/server/domain/errors";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Traduce cualquier error capturado en un route handler a una respuesta HTTP
 * consistente, sin filtrar stack traces ni mensajes internos al cliente.
 */
export function handleApiError(error: unknown) {
  if (error instanceof DomainError) {
    return fail(error.code, error.message, error.status);
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Los datos enviados no son válidos.";
    return fail("VALIDATION_ERROR", message, 400);
  }
  console.error("[api] unhandled error:", error);
  return fail(
    "INTERNAL_ERROR",
    "Ocurrió un problema inesperado. Intenta nuevamente en unos minutos.",
    500
  );
}
