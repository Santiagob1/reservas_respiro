import { fail, ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * Sube una imagen (ej. el QR de pago, imagen de función especial) a Vercel
 * Blob y devuelve una URL servible públicamente. Requiere que el proyecto
 * tenga un Blob Store creado en Vercel (Storage → Create Database → Blob).
 *
 * El store de este proyecto está configurado en modo "private" (no "public"),
 * así que subimos con access:"private" y servimos el archivo a través de
 * `/api/blob` (ver esa ruta) en vez de devolver la URL directa de Vercel —
 * esa URL directa exige autenticación y no es visitable desde un <img src>.
 */
export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return fail(
        "BLOB_NOT_CONFIGURED",
        "La subida de archivos no está activada todavía. En tu proyecto de Vercel ve a Storage → Create Database → Blob, y vuelve a intentar (no necesitas configurar nada más). Mientras tanto puedes pegar el link de la imagen directamente.",
        503
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "Selecciona un archivo de imagen.", 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return fail("VALIDATION_ERROR", "Solo se aceptan imágenes PNG, JPG, WEBP o SVG.", 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return fail("VALIDATION_ERROR", "La imagen no puede pesar más de 5MB.", 400);
    }

    const { put } = await import("@vercel/blob");
    const extension = file.name.split(".").pop() || "png";
    const blob = await put(`payment-qr/${admin.id}-${Date.now()}.${extension}`, file, {
      access: "private",
      addRandomSuffix: true,
    });

    return ok({ url: `/api/blob?pathname=${encodeURIComponent(blob.pathname)}` });
  } catch (error) {
    return handleApiError(error);
  }
}
