import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();
const TIMEZONE = process.env.TIMEZONE || "America/Bogota";

function nextDatesForWeekdays(count: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1); // desde mañana
  while (dates.length < count) {
    const day = cursor.getDay(); // 0 = domingo
    if (day !== 0) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      dates.push(fromZonedTime(`${y}-${m}-${d}T19:00:00`, TIMEZONE));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function main() {
  console.log("Sembrando datos demo de Cine Respiro...");

  // --- Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@cinerespiro.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "CambiaEstaClave123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Administrador",
      role: "OWNER",
    },
  });
  console.log(`Admin listo: ${adminEmail} / ${adminPassword}`);

  // --- Productos ---
  const ticketTypesData = [
    {
      name: "General",
      description: "Entrada a la función.",
      price: 15000,
      includes: ["Entrada a la función"],
      sortOrder: 1,
    },
    {
      name: "Combo",
      description: "Entrada + crispetas, bebida y postre.",
      price: 30000,
      includes: ["Entrada a la función", "Crispetas", "Bebida", "Postre"],
      sortOrder: 2,
    },
    {
      name: "Combo con comida",
      description: "Entrada + crispetas, bebida, postre y nachos de pollo.",
      price: 45000,
      includes: ["Entrada a la función", "Crispetas", "Bebida", "Postre", "Nachos de pollo"],
      sortOrder: 3,
    },
  ];
  for (const t of ticketTypesData) {
    const existing = await prisma.ticketType.findFirst({ where: { name: t.name } });
    if (!existing) await prisma.ticketType.create({ data: t });
  }

  // --- Películas ---
  const moviesData = [
    {
      title: "Interestelar",
      description:
        "Un grupo de exploradores viaja a través de un agujero de gusano en el espacio en un intento por garantizar la supervivencia de la humanidad.",
      durationMinutes: 169,
      genre: "Ciencia ficción",
      rating: "PG-13",
      posterUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    },
    {
      title: "El Padrino",
      description:
        "La crónica de la familia Corleone, una dinastía del crimen organizado en Nueva York, y la transformación de Michael Corleone.",
      durationMinutes: 175,
      genre: "Drama",
      rating: "R",
      posterUrl: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    },
    {
      title: "Intensamente 2",
      description:
        "Riley entra en la adolescencia y su mente debe lidiar con la llegada de nuevas emociones.",
      durationMinutes: 96,
      genre: "Animación",
      rating: "PG",
      posterUrl: "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
    },
  ];

  const movies = [];
  for (const m of moviesData) {
    const existing = await prisma.movie.findFirst({ where: { title: m.title } });
    movies.push(existing ?? (await prisma.movie.create({ data: m })));
  }

  // --- Funciones: próximos 12 días hábiles (lunes a sábado), 7:00 PM, publicadas ---
  const dates = nextDatesForWeekdays(12);
  for (let i = 0; i < dates.length; i++) {
    const movie = movies[i % movies.length];
    const startsAt = dates[i];
    const exists = await prisma.showtime.findFirst({ where: { startsAt } });
    if (!exists) {
      await prisma.showtime.create({
        data: {
          movieId: movie.id,
          startsAt,
          capacity: 15,
          status: "PUBLISHED",
          weekPublished: true,
        },
      });
    }
  }

  console.log("Semilla completada.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
