import { ReservationDetail } from "@/components/public/ReservationDetail";
import { LookupForm } from "@/components/public/LookupForm";

export default async function ReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ contact?: string }>;
}) {
  const { code } = await params;
  const { contact } = await searchParams;

  if (!contact) {
    return <LookupForm initialCode={code} />;
  }

  return <ReservationDetail code={code} contact={contact} />;
}
