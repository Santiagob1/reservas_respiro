/**
 * Proceso independiente que expira reservas PENDING_PAYMENT vencidas cada
 * minuto (sección 85). Corre como servicio separado en Docker Compose, pero
 * es solo una conveniencia operativa: la disponibilidad mostrada al público
 * NUNCA depende de que este proceso esté corriendo, porque
 * availability.service ya excluye en la propia consulta las reservas
 * PENDING_PAYMENT vencidas (defensa en profundidad).
 */
import cron from "node-cron";
import { expireOverdueReservations } from "../src/server/services/reservation.service";

async function tick() {
  try {
    const count = await expireOverdueReservations();
    if (count > 0) {
      console.log(`[worker] ${count} reserva(s) expirada(s) y cupos liberados`);
    }
  } catch (error) {
    console.error("[worker] error al expirar reservas:", error);
  }
}

console.log("[worker] iniciado — expirando reservas vencidas cada minuto");
cron.schedule("* * * * *", tick);
tick();
