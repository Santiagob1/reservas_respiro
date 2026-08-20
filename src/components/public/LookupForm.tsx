"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LookupForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [contact, setContact] = useState("");
  const router = useRouter();

  return (
    <form
      className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/reserva/${code.trim().toUpperCase()}?contact=${encodeURIComponent(contact.trim())}`);
      }}
    >
      <h1 className="font-display text-3xl text-cream">Mi reserva</h1>
      <p className="text-sm text-cream-dim">
        Ingresa tu código de reserva y el WhatsApp o correo con el que la hiciste.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm text-cream-dim">
          Código de reserva
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CIN-8F42K"
          required
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact" className="text-sm text-cream-dim">
          WhatsApp o correo
        </label>
        <input
          id="contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="3001234567 o tucorreo@ejemplo.com"
          required
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
        />
      </div>

      <Button type="submit">Buscar mi reserva</Button>
    </form>
  );
}
