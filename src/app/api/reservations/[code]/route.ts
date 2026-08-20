import { ok, fail, handleApiError } from "@/lib/api-response";
import { getReservationByCode } from "@/server/services/reservation.service";
import { toReservationDto } from "@/server/dto/reservation.dto";

/**
 * Consulta pública de una reserva. Por privacidad (sección 71), el código no
 * es suficiente por sí solo: se exige además el WhatsApp o correo con el que
 * se hizo la reserva.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(req.url);
    const contact = searchParams.get("contact")?.trim().toLowerCase();

    if (!contact) {
      return fail(
        "CONTACT_REQUIRED",
        "Ingresa el WhatsApp o correo con el que hiciste la reserva.",
        400
      );
    }

    const reservation = await getReservationByCode(code);

    const matchesWhatsapp = reservation.customer.whatsapp.replace(/\s/g, "").toLowerCase().includes(contact.replace(/\s/g, ""));
    const matchesEmail = reservation.customer.email?.toLowerCase() === contact;

    if (!matchesWhatsapp && !matchesEmail) {
      return fail("RESERVATION_NOT_FOUND", "No encontramos una reserva con esos datos.", 404);
    }

    return ok(toReservationDto(reservation));
  } catch (error) {
    return handleApiError(error);
  }
}
