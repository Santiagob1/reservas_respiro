import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { getSettings } from "@/server/services/settings.service";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      <Header instagramUrl={settings.instagram_url || undefined} whatsapp={settings.cinema_whatsapp} />
      <main className="flex-1">{children}</main>
      <Footer
        cinemaName={settings.cinema_name}
        whatsapp={settings.cinema_whatsapp}
        email={settings.cinema_email}
        address={settings.cinema_address}
        instagramUrl={settings.instagram_url || undefined}
        termsUrl={settings.terms_url || undefined}
        privacyPolicyUrl={settings.privacy_policy_url || undefined}
        cancellationPolicyUrl={settings.cancellation_policy_url || undefined}
      />
    </>
  );
}
