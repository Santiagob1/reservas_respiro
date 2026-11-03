-- AlterTable
ALTER TABLE "showtimes" ADD COLUMN     "roomId" TEXT;

-- AlterTable
ALTER TABLE "venue_modules" ADD COLUMN     "roomId" TEXT;

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_modules" ADD CONSTRAINT "venue_modules_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos: las dos salas fisicas del negocio. Sala 1 = los 4 modulos pareja,
-- Sala 2 = los 2 modulos trio. Las funciones ya existentes quedan con
-- roomId = NULL (layout anterior combinado) para no alterar reservas ya
-- hechas; las funciones nuevas siempre se crean con una sala.
INSERT INTO "rooms" ("id", "name", "sortOrder", "active", "updatedAt") VALUES
    ('room_sala_1', 'Sala 1', 1, true, CURRENT_TIMESTAMP),
    ('room_sala_2', 'Sala 2', 2, true, CURRENT_TIMESTAMP);

UPDATE "venue_modules" SET "roomId" = 'room_sala_1' WHERE "type" = 'COUPLE';
UPDATE "venue_modules" SET "roomId" = 'room_sala_2' WHERE "type" = 'TRIO';
