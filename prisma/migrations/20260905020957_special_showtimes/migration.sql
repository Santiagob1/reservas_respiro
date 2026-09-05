-- AlterTable
ALTER TABLE "showtimes" ADD COLUMN     "isSpecial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialAdImageUrl" TEXT,
ADD COLUMN     "specialDescription" TEXT,
ADD COLUMN     "specialMenuPrice" INTEGER,
ADD COLUMN     "specialTicketTypeId" TEXT;
-- AlterTable
ALTER TABLE "ticket_types" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;
-- CreateTable
CREATE TABLE "showtime_ticket_types" (
    "id" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showtime_ticket_types_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "showtime_ticket_types_showtimeId_ticketTypeId_key" ON "showtime_ticket_types"("showtimeId", "ticketTypeId");
-- CreateIndex
CREATE UNIQUE INDEX "showtimes_specialTicketTypeId_key" ON "showtimes"("specialTicketTypeId");
-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_specialTicketTypeId_fkey" FOREIGN KEY ("specialTicketTypeId") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "showtime_ticket_types" ADD CONSTRAINT "showtime_ticket_types_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "showtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "showtime_ticket_types" ADD CONSTRAINT "showtime_ticket_types_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
