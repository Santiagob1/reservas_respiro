import Link from "next/link";

export function Footer({
  cinemaName,
  whatsapp,
  email,
  address,
  instagramUrl,
  tiktokUrl,
  locationUrl,
  menuUrl,
  termsUrl,
  privacyPolicyUrl,
  cancellationPolicyUrl,
}: {
  cinemaName: string;
  whatsapp: string;
  email: string;
  address: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  locationUrl?: string;
  menuUrl?: string;
  termsUrl?: string;
  privacyPolicyUrl?: string;
  cancellationPolicyUrl?: string;
}) {
  const whatsappUrl = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;

  return (
    <footer className="border-t border-line px-4 py-8 text-sm text-muted sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg text-cream-dim">{cinemaName}</p>
          {locationUrl ? (
            <Link href={locationUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              {address}
            </Link>
          ) : (
            <p>{address}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {menuUrl && (
            <Link href={menuUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              Carta
            </Link>
          )}
          <Link href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
            WhatsApp
          </Link>
          {instagramUrl && (
            <Link href={instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              Instagram
            </Link>
          )}
          {tiktokUrl && (
            <Link href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              TikTok
            </Link>
          )}
          <Link href="/nosotros" className="hover:text-gold">
            Nosotros
          </Link>
          {termsUrl && (
            <Link href={termsUrl} className="hover:text-gold">
              Términos
            </Link>
          )}
          {privacyPolicyUrl && (
            <Link href={privacyPolicyUrl} className="hover:text-gold">
              Privacidad
            </Link>
          )}
          {cancellationPolicyUrl && (
            <Link href={cancellationPolicyUrl} className="hover:text-gold">
              Cancelaciones
            </Link>
          )}
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-xs">{email}</p>
    </footer>
  );
}
