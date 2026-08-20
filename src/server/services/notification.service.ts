import { prisma } from "@/lib/prisma";
import { formatCinemaDate, formatCinemaTime } from "@/lib/timezone";

/**
 * Las notificaciones nunca deben bloquear ni condicionar el resultado de una
 * reserva/pago (sección 47). Cada intento se registra con su propio estado;
 * un fallo aquí jamás revierte ni impide la operación que lo disparó.
 */
export type NotificationEvent =
  | "RESERVATION_CONFIRMED"
  | "ADMIN_NEW_SALE"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_RESCHEDULED"
  | "SHOWTIME_CANCELLED"
  | "REMINDER_24H"
  | "REMINDER_2H";

export async function queueNotification(params: {
  reservationId: string;
  channel: "EMAIL" | "WHATSAPP";
  event: NotificationEvent;
  payload?: Record<string, unknown>;
}) {
  const notification = await prisma.notification.create({
    data: {
      reservationId: params.reservationId,
      channel: params.channel,
      event: params.event,
      payload: params.payload as never,
      status: "PENDING",
    },
  });

  // Envío best-effort, fuera del flujo transaccional que la originó.
  void dispatchNotification(notification.id).catch((err) => {
    console.error("[notifications] dispatch failed:", err);
  });

  return notification;
}

async function dispatchNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return;

  try {
    if (notification.channel === "EMAIL") {
      await sendEmailNotification(notification.reservationId, notification.event as NotificationEvent);
    } else {
      console.log(`[notification:WHATSAPP] evento=${notification.event} reserva=${notification.reservationId}`);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (error) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
    });
  }
}

async function sendEmailNotification(reservationId: string, event: NotificationEvent) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      showtime: { include: { movie: true } },
      items: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!reservation) return;

  if (event === "RESERVATION_CONFIRMED") {
    await sendEmail({
      to: reservation.customer.email,
      subject: `Tu reserva está confirmada — ${reservation.code}`,
      html: customerConfirmationEmail(reservation),
    });
  } else if (event === "ADMIN_NEW_SALE") {
    const { getSetting } = await import("@/server/services/settings.service");
    const businessEmail = await getSetting("business_sales_email");
    await sendEmail({
      to: businessEmail || null,
      subject: `Nueva venta — ${reservation.code} (${formatCOP(reservation.totalAmount)})`,
      html: adminSaleEmail(reservation),
    });
  } else {
    // Otros eventos (cancelación, reagendamiento, recordatorios) quedan como
    // punto de extensión; por ahora solo se registran, sin plantilla propia.
    console.log(`[notification:EMAIL] evento=${event} reserva=${reservationId} (sin plantilla)`);
  }
}

async function sendEmail(params: { to: string | null; subject: string; html: string }) {
  if (!params.to) {
    console.log(`[email] destinatario no configurado, se omite envío: "${params.subject}"`);
    return;
  }

  const provider = process.env.NOTIFICATIONS_PROVIDER ?? "resend";
  const apiKey = process.env.RESEND_API_KEY;

  if (provider !== "resend" || !apiKey) {
    console.log(`[email:console] para=${params.to} asunto="${params.subject}"`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "Cine Respiro <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

function formatCOP(amount: number): string {
  return amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

type ReservationForEmail = {
  code: string;
  totalAmount: number;
  adults: number;
  children: number;
  source: string;
  customer: { fullName: string; whatsapp: string; email: string | null };
  showtime: { startsAt: Date; movie: { title: string } };
  items: { ticketTypeName: string; quantity: number; total: number }[];
  payments: { method: string; cashReference: string | null }[];
};

function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#1b120c; padding:32px 16px; color:#f4e9d8;">
    <div style="max-width:480px; margin:0 auto; background:#241a12; border-radius:16px; padding:32px; border:1px solid #3d2c1e;">
      <p style="letter-spacing:0.2em; text-transform:uppercase; color:#d4a556; font-size:12px; margin:0 0 8px;">Cine Respiro</p>
      <h1 style="font-size:22px; margin:0 0 20px; color:#f4e9d8;">${title}</h1>
      ${bodyHtml}
    </div>
  </div>`;
}

function customerConfirmationEmail(r: ReservationForEmail): string {
  const people = r.adults + r.children;
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const link = `${appUrl}/reserva/${r.code}?contact=${encodeURIComponent(r.customer.whatsapp)}`;

  const items = r.items
    .map((i) => `<tr><td style="padding:4px 0;">${i.quantity} × ${i.ticketTypeName}</td><td style="text-align:right;">${formatCOP(i.total)}</td></tr>`)
    .join("");

  return emailShell(
    "Ya está. Tienes tu entrada.",
    `
    <p style="color:#d9c9b3; line-height:1.5;">Hola ${r.customer.fullName}, tu reserva quedó confirmada.</p>
    <p style="font-size:13px; color:#a68a6c; margin-top:16px;">Código de reserva</p>
    <p style="font-size:20px; font-weight:600; letter-spacing:0.05em; color:#e8c988; margin:0 0 16px;">${r.code}</p>
    <p style="margin:0; color:#f4e9d8;">${r.showtime.movie.title}</p>
    <p style="margin:0 0 16px; color:#d9c9b3;">${formatCinemaDate(r.showtime.startsAt)} · ${formatCinemaTime(r.showtime.startsAt)} · ${people} persona${people === 1 ? "" : "s"}</p>
    <table style="width:100%; border-top:1px solid #3d2c1e; padding-top:8px; font-size:14px; color:#d9c9b3;">${items}</table>
    <p style="text-align:right; font-weight:600; color:#e8c988; margin-top:8px;">Total: ${formatCOP(r.totalAmount)}</p>
    <a href="${link}" style="display:inline-block; margin-top:24px; background:#d4a556; color:#1b120c; padding:12px 24px; border-radius:999px; text-decoration:none; font-weight:600;">Ver mi reserva y código QR</a>
    <p style="font-size:12px; color:#a68a6c; margin-top:24px;">Presenta el código QR de ese enlace al llegar al cine.</p>
    `
  );
}

function adminSaleEmail(r: ReservationForEmail): string {
  const people = r.adults + r.children;
  const payment = r.payments[0];
  const items = r.items
    .map((i) => `<tr><td style="padding:4px 0;">${i.quantity} × ${i.ticketTypeName}</td><td style="text-align:right;">${formatCOP(i.total)}</td></tr>`)
    .join("");

  return emailShell(
    "Nueva venta confirmada",
    `
    <p style="font-size:13px; color:#a68a6c;">Código de reserva</p>
    <p style="font-size:20px; font-weight:600; letter-spacing:0.05em; color:#e8c988; margin:0 0 16px;">${r.code}</p>
    <p style="margin:0; color:#f4e9d8;">${r.showtime.movie.title}</p>
    <p style="margin:0 0 16px; color:#d9c9b3;">${formatCinemaDate(r.showtime.startsAt)} · ${formatCinemaTime(r.showtime.startsAt)} · ${people} persona${people === 1 ? "" : "s"}</p>
    <p style="font-size:13px; color:#a68a6c; margin-bottom:2px;">Cliente</p>
    <p style="margin:0 0 16px; color:#f4e9d8;">${r.customer.fullName} · ${r.customer.whatsapp}${r.customer.email ? ` · ${r.customer.email}` : ""}</p>
    <table style="width:100%; border-top:1px solid #3d2c1e; padding-top:8px; font-size:14px; color:#d9c9b3;">${items}</table>
    <p style="text-align:right; font-weight:600; color:#e8c988; margin-top:8px;">Total: ${formatCOP(r.totalAmount)}</p>
    <p style="font-size:13px; color:#a68a6c; margin-top:16px;">Método de pago: ${payment?.method ?? "—"}${payment?.cashReference ? ` (ref: ${payment.cashReference})` : ""} · Canal: ${r.source}</p>
    `
  );
}
