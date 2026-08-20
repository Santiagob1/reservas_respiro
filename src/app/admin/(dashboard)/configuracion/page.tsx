"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/formStyles";

interface Settings {
  cinema_name: string;
  cinema_tagline: string;
  cinema_hero_message: string;
  cinema_whatsapp: string;
  cinema_email: string;
  cinema_address: string;
  arrival_info: string;
  default_capacity: number;
  default_showtime_hour: string;
  reservation_hold_minutes: number;
  cash_reservation_hold_hours: number;
  low_availability_threshold: number;
  terms_url: string;
  privacy_policy_url: string;
  cancellation_policy_url: string;
  instagram_url: string;
  about_us_text: string;
  business_sales_email: string;
  payment_mode: "transfer" | "online";
  payment_transfer_key: string;
  payment_transfer_instructions: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<Settings>("/api/admin/settings").then(setSettings);
  }, []);

  if (!settings) return <p className="text-muted">Cargando...</p>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setLoading(true);
    setError(null);
    try {
      await apiPatch("/api/admin/settings", settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-3xl text-cream">Configuración</h1>

      <Section title="Identidad">
        <Field label="Nombre del cine">
          <input value={settings.cinema_name} onChange={(e) => set("cinema_name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Eslogan">
          <input value={settings.cinema_tagline} onChange={(e) => set("cinema_tagline", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Mensaje del hero">
          <input
            value={settings.cinema_hero_message}
            onChange={(e) => set("cinema_hero_message", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Contacto">
        <Field label="WhatsApp">
          <input value={settings.cinema_whatsapp} onChange={(e) => set("cinema_whatsapp", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Correo">
          <input value={settings.cinema_email} onChange={(e) => set("cinema_email", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Dirección">
          <input value={settings.cinema_address} onChange={(e) => set("cinema_address", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Información de llegada">
          <textarea
            value={settings.arrival_info}
            onChange={(e) => set("arrival_info", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Instagram (URL, opcional)">
          <input
            value={settings.instagram_url}
            onChange={(e) => set("instagram_url", e.target.value)}
            placeholder="https://instagram.com/cinerespiro"
            className={inputClass}
          />
        </Field>
        <Field label="Correo del negocio (recibe el aviso de cada venta)">
          <input
            value={settings.business_sales_email}
            onChange={(e) => set("business_sales_email", e.target.value)}
            placeholder="ventas@cinerespiro.com"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Sobre nosotros">
        <Field label="Texto de la página 'Sobre nosotros'">
          <textarea
            value={settings.about_us_text}
            onChange={(e) => set("about_us_text", e.target.value)}
            rows={5}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Pago">
        <Field label="Modo de pago del sitio público">
          <select
            value={settings.payment_mode}
            onChange={(e) => set("payment_mode", e.target.value as "transfer" | "online")}
            className={inputClass}
          >
            <option value="transfer">Transferencia + comprobante por WhatsApp</option>
            <option value="online">Pasarela de pago en línea</option>
          </select>
        </Field>
        {settings.payment_mode === "transfer" && (
          <>
            <Field label="Llave o cuenta interoperable para transferir">
              <input
                value={settings.payment_transfer_key}
                onChange={(e) => set("payment_transfer_key", e.target.value)}
                placeholder="Ej. llave Bre-B, número Nequi, cuenta bancaria..."
                className={inputClass}
              />
            </Field>
            <Field label="Instrucciones de pago">
              <textarea
                value={settings.payment_transfer_instructions}
                onChange={(e) => set("payment_transfer_instructions", e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="Reservas">
        <Field label="Capacidad por defecto">
          <input
            type="number"
            value={settings.default_capacity}
            onChange={(e) => set("default_capacity", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Hora por defecto">
          <input
            value={settings.default_showtime_hour}
            onChange={(e) => set("default_showtime_hour", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Minutos de bloqueo (pago en línea)">
          <input
            type="number"
            value={settings.reservation_hold_minutes}
            onChange={(e) => set("reservation_hold_minutes", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Horas de bloqueo (efectivo/transferencia)">
          <input
            type="number"
            value={settings.cash_reservation_hold_hours}
            onChange={(e) => set("cash_reservation_hold_hours", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Umbral de 'últimos cupos'">
          <input
            type="number"
            value={settings.low_availability_threshold}
            onChange={(e) => set("low_availability_threshold", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Políticas (URLs opcionales)">
        <Field label="Términos">
          <input value={settings.terms_url} onChange={(e) => set("terms_url", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Privacidad">
          <input
            value={settings.privacy_policy_url}
            onChange={(e) => set("privacy_policy_url", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Cancelaciones">
          <input
            value={settings.cancellation_policy_url}
            onChange={(e) => set("cancellation_policy_url", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Configuración guardada.</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-card p-5">
      <h2 className="mb-4 font-display text-xl text-cream">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-cream-dim">
      {label}
      {children}
    </label>
  );
}
