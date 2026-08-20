import { PaymentStatus } from "@/components/public/PaymentStatus";
import { LookupForm } from "@/components/public/LookupForm";

export default async function EstadoPagoPage({
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

  return <PaymentStatus code={code} contact={contact} />;
}
