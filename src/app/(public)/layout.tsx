import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { getSettings } from "@/server/services/settings.service";

// Todo el sitio público lee datos que cambian en tiempo real (disponibilidad,
// configuración editable desde el admin). Sin esto, Next.js congelaría la
// home y otras páginas sin parámetros dinámicos como HTML estático generado
// una sola vez en el build, y los cupos mostrados quedarían desactualizados.
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      <Header
        instagramUrl={settings.instagram_url || undefined}
        tiktokUrl={settings.tiktok_url || undefined}
        locationUrl={settings.location_url || undefined}
        menuUrl={settings.menu_url || undefined}
        whatsapp={settings.cinema_whatsapp}
      />
      <main className="flex-1">{children}</main>
      <Footer
        cinemaName={settings.cinema_name}
        whatsapp={settings.cinema_whatsapp}
        email={settings.cinema_email}
        address={settings.cinema_address}
        instagramUrl={settings.instagram_url || undefined}
        tiktokUrl={settings.tiktok_url || undefined}
        locationUrl={settings.location_url || undefined}
        menuUrl={settings.menu_url || undefined}
        termsUrl={settings.terms_url || undefined}
        privacyPolicyUrl={settings.privacy_policy_url || undefined}
        cancellationPolicyUrl={settings.cancellation_policy_url || undefined}
      />
    </>
  );
}
