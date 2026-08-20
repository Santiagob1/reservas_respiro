-- CreateEnum
CREATE TYPE "VenueModuleType" AS ENUM ('COUPLE', 'TRIO');

-- CreateTable
CREATE TABLE "venue_modules" (
    "id" TEXT NOT NULL,
    "type" "VenueModuleType" NOT NULL,
    "label" TEXT NOT NULL,
    "baseCapacity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_module_assignments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "venueModuleId" TEXT NOT NULL,
    "seatsOccupied" INTEGER NOT NULL,
    "usesAuxiliary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_module_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reservation_module_assignments" ADD CONSTRAINT "reservation_module_assignments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_module_assignments" ADD CONSTRAINT "reservation_module_assignments_venueModuleId_fkey" FOREIGN KEY ("venueModuleId") REFERENCES "venue_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
