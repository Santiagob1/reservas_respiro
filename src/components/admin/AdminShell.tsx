"use client";

import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 shrink-0 sm:block">
        <AdminSidebar adminName={adminName} />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:hidden">
          <p className="font-display text-lg text-cream">Cine Respiro</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-cream"
          >
            Menú
          </button>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex sm:hidden">
            <div className="w-72">
              <AdminSidebar adminName={adminName} />
            </div>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="flex-1 bg-black/60"
              onClick={() => setOpen(false)}
            />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
