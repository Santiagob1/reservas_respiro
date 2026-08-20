import type { NextConfig } from "next";

// Nota: NO usar output: "standalone" aquí — rompe el build de Vercel
// (su empaquetado de funciones serverless espera la estructura por defecto
// de .next, no la de standalone). "standalone" solo aplica si algún día se
// despliega con el Dockerfile de este repo en un servidor propio.
const nextConfig: NextConfig = {};

export default nextConfig;
