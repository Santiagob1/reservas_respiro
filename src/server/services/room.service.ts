import { prisma } from "@/lib/prisma";
import { getPhysicalRoomCapacity } from "@/server/services/seating.service";

export interface RoomSummary {
  id: string;
  name: string;
  baseCapacity: number;
  maxCapacity: number;
}

/** Salas activas con su capacidad física (base y máxima con las piezas auxiliares). */
export async function listRooms(): Promise<RoomSummary[]> {
  const rooms = await prisma.room.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return Promise.all(
    rooms.map(async (room) => {
      const capacity = await getPhysicalRoomCapacity(room.id);
      return { id: room.id, name: room.name, baseCapacity: capacity.base, maxCapacity: capacity.max };
    })
  );
}
