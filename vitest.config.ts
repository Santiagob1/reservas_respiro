import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    // Los tests de concurrencia usan la misma base de Postgres (Docker) y no
    // deben correr en paralelo entre archivos, para evitar interferencia
    // entre pruebas que comparten funciones/reservas.
    fileParallelism: false,
  },
});
