import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sirve públicamente un archivo guardado en el store de Vercel Blob, que está
 * configurado en modo "private" (no permite `access: "public"` al subir).
 * A diferencia del ejemplo de Vercel, esta ruta no exige sesión de admin a
 * propósito: lo que aquí se guarda (pósters, QR de pago, imágenes de
 * funciones especiales) es contenido pensado para verse públicamente en el
 * sitio, solo que vive en un store marcado como privado a nivel de Vercel.
 */
export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }

  const { get } = await import("@vercel/blob");
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
