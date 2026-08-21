/**
 * Borra todos los datos de actividad (películas, funciones, reservas,
 * clientes, pagos, notificaciones, auditoría) para dejar la base de datos
 * lista para empezar a operar de verdad.
 *
 * Se conserva SIEMPRE:
 *   - Setting          (configuración del sitio: nombre, WhatsApp, pago, enlaces...)
 *   - AdminUser         (tu cuenta de administrador — nunca se toca)
 *   - VenueModule       (el layout físico de la sala: módulos pareja/trío)
 *   - TicketType        (los productos: General/Combo/Combo con comida)
 *
 * Por seguridad, sin el flag --yes solo MUESTRA cuántas filas de cada tabla
 * se borrarían (no borra nada). Corre primero sin --yes para revisar, y
 * luego con --yes para ejecutar de verdad.
 *
 *   npx tsx scripts/reset-for-launch.ts            # vista previa
 *   npx tsx scripts/reset-for-launch.ts --yes       # borra de verdad
 */
import { prisma } from "../src/lib/prisma";

const CONFIRM = process.argv.includes("--yes");

async function main() {
  const counts = {
    checkIns: await prisma.checkIn.count(),
    paymentTransactions: await prisma.paymentTransaction.count(),
    payments: await prisma.payment.count(),
    notifications: await prisma.notification.count(),
    statusHistory: await prisma.reservationStatusHistory.count(),
    moduleAssignments: await prisma.reservationModuleAssignment.count(),
    reservationItems: await prisma.reservationItem.count(),
    reservations: await prisma.reservation.count(),
    customers: await prisma.customer.count(),
    showtimes: await prisma.showtime.count(),
    movies: await prisma.movie.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("Se van a borrar estas filas:");
  console.table(counts);
  console.log("\nSe conservan: Setting, AdminUser, VenueModule, TicketType.\n");

  if (!CONFIRM) {
    console.log("Vista previa solamente — nada fue borrado. Vuelve a correr con --yes para ejecutar.");
    return;
  }

  console.log("Borrando...");
  await prisma.checkIn.deleteMany({});
  await prisma.paymentTransaction.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.reservationStatusHistory.deleteMany({});
  await prisma.reservationModuleAssignment.deleteMany({});
  await prisma.reservationItem.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.showtime.deleteMany({});
  await prisma.movie.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log("Listo. Base de datos limpia para empezar a cargar datos reales.");
  console.log("Quedan intactos: configuración del sitio, tu cuenta de admin, el layout de módulos y los productos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
