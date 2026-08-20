import { ReservationWizard } from "@/components/public/wizard/ReservationWizard";

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ showtimeId?: string }>;
}) {
  const { showtimeId } = await searchParams;
  return <ReservationWizard initialShowtimeId={showtimeId} />;
}
