import path from "path";

process.loadEnvFile(path.resolve(__dirname, "../.env"));

// Seguro obligatorio: las pruebas crean y borran datos (películas, reservas,
// admins de prueba). Si DATABASE_URL no apunta claramente a una base local,
// abortar — para que un .env mal configurado nunca corra pruebas contra una
// base de datos real de producción (ej. Neon).
const dbUrl = process.env.DATABASE_URL ?? "";
const looksLocal = /(localhost|127\.0\.0\.1)/.test(dbUrl);
if (!looksLocal) {
  throw new Error(
    "DATABASE_URL no parece apuntar a una base de datos local (localhost/127.0.0.1). " +
      "Las pruebas crean y borran datos y NUNCA deben correr contra producción. " +
      "Revisa tu archivo .env antes de ejecutar `npm run test`."
  );
}

const { ensureVenueModules } = await import("./helpers");
await ensureVenueModules();
