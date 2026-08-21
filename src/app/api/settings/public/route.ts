import { ok, handleApiError } from "@/lib/api-response";
import { getSettings } from "@/server/services/settings.service";

/** Solo expone la configuración necesaria para el sitio público (nunca secretos). */
export async function GET() {
  try {
    const settings = await getSettings();
    return ok({
      cinemaName: settings.cinema_name,
      tagline: settings.cinema_tagline,
      heroMessage: settings.cinema_hero_message,
      whatsapp: settings.cinema_whatsapp,
      email: settings.cinema_email,
      address: settings.cinema_address,
      arrivalInfo: settings.arrival_info,
      termsUrl: settings.terms_url,
      privacyPolicyUrl: settings.privacy_policy_url,
      cancellationPolicyUrl: settings.cancellation_policy_url,
      reservationHoldMinutes: settings.reservation_hold_minutes,
      instagramUrl: settings.instagram_url,
      aboutUsText: settings.about_us_text,
      paymentMode: settings.payment_mode,
      paymentTransferKey: settings.payment_transfer_key,
      paymentTransferInstructions: settings.payment_transfer_instructions,
      paymentQrUrl: settings.payment_qr_url,
      cashReservationHoldHours: settings.cash_reservation_hold_hours,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
