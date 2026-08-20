const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-warning/15 text-warning",
  PAYMENT_APPROVED: "bg-success/15 text-success",
  CONFIRMED: "bg-success/15 text-success",
  CHECKED_IN: "bg-gold/15 text-gold",
  CANCELLED: "bg-danger/15 text-danger",
  EXPIRED: "bg-danger/15 text-danger",
  REFUNDED: "bg-muted/15 text-muted",
  NO_SHOW: "bg-muted/15 text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pago pendiente",
  PAYMENT_APPROVED: "Pago aprobado",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Ingreso registrado",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  REFUNDED: "Reembolsada",
  NO_SHOW: "No asistió",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted/15 text-muted"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
