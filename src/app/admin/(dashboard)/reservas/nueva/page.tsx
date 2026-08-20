"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/public/wizard/Counter";
import { formatCOP } from "@/components/public/wizard/types";

interface ShowtimeOption {
  id: string;
  startsAt: string;
  status: string;
  movie: { title: string };
  availability: { available: number };
}

interface TicketTypeOption {
  id: string;
  name: string;
  price: number;
}

export default function NewManualReservationPage() {
  const router = useRouter();
  const [showtimes, setShowtimes] = useState<ShowtimeOption[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([]);
  const [showtimeId, setShowtimeId] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "OTHER" | "ONLINE">("CASH");
  const [source, setSource] = useState<"ADMIN_MANUAL" | "WHATSAPP" | "PHONE" | "WALK_IN">("ADMIN_MANUAL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const from = new Date().toISOString();
    apiGet<ShowtimeOption[]>(`/api/admin/showtimes?from=${from}`).then((all) =>
      setShowtimes(all.filter((s) => !["CANCELLED", "FINISHED"].includes(s.status)))
    );
    apiGet<TicketTypeOption[]>("/api/ticket-types").then(setTicketTypes);
  }, []);

  const people = adults + children;
  const itemsQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const total = ticketTypes.reduce((sum, t) => sum + (quantities[t.id] ?? 0) * t.price, 0);
  const selected = showtimes.find((s) => s.id === showtimeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const reservation = await apiPost<{ id: string; code: string }>("/api/admin/reservations", {
        showtimeId,
        adults,
        children,
        items: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        customer: { fullName, whatsapp, email: email || undefined },
        source,
        paymentMethod,
      });
      router.push(`/admin/reservas/${reservation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la reserva.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl text-cream">Reserva manual</h1>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-cream-dim">Función</label>
        <select
          value={showtimeId}
          onChange={(e) => setShowtimeId(e.target.value)}
          required
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
        >
          <option value="">Selecciona una función</option>
          {showtimes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.movie.title} · {new Date(s.startsAt).toLocaleString("es-CO")} · {s.availability.available} cupos
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <Counter label="Adultos" value={adults} max={selected?.availability.available ?? 15} onChange={setAdults} />
        <Counter label="Niños" value={children} max={selected?.availability.available ?? 15} onChange={setChildren} />
      </div>

      <div className="flex flex-col gap-3">
        {ticketTypes.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
            <span className="text-cream">
              {t.name} · {formatCOP(t.price)}
            </span>
            <Counter
              label=""
              value={quantities[t.id] ?? 0}
              max={selected?.availability.available ?? 15}
              onChange={(v) => setQuantities((prev) => ({ ...prev, [t.id]: v }))}
            />
          </div>
        ))}
        {people > 0 && itemsQty !== people && (
          <p className="text-sm text-warning">
            {itemsQty} entradas para {people} personas — deben coincidir.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-cream-dim">Nombre completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-cream-dim">WhatsApp</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
            className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm text-cream-dim">Correo (opcional)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-cream-dim">Método de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          >
            <option value="CASH">Efectivo</option>
            <option value="BANK_TRANSFER">Transferencia</option>
            <option value="OTHER">Otro</option>
            <option value="ONLINE">En línea (registro manual)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-cream-dim">Canal</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          >
            <option value="ADMIN_MANUAL">Manual</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PHONE">Teléfono</option>
            <option value="WALK_IN">Presencial</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between rounded-xl border border-line px-4 py-3">
        <span className="text-cream">Total</span>
        <span className="font-display text-xl text-gold">{formatCOP(total)}</span>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={loading || !showtimeId || itemsQty !== people || people === 0}>
        {loading ? "Guardando..." : "Guardar reserva"}
      </Button>
    </form>
  );
}
