import { prisma } from "@/lib/prisma";

/** Valores por defecto — nunca hardcodeados en el frontend, siempre sobre-escribibles desde admin. */
export const DEFAULT_SETTINGS = {
  cinema_name: "Cine Respiro",
  cinema_tagline: "Cine, café y juego",
  cinema_hero_message: "El cine se disfruta mejor de cerca.",
  cinema_whatsapp: "573000000000",
  cinema_email: "reservas@cinerespiro.com",
  cinema_address: "Por confirmar",
  arrival_info: "Te recomendamos llegar 15 minutos antes de la función y presentar tu código o QR en la entrada.",
  default_capacity: 15,
  default_showtime_hour: "19:00",
  reservation_hold_minutes: Number(process.env.RESERVATION_HOLD_MINUTES ?? 15),
  cash_reservation_hold_hours: Number(process.env.CASH_RESERVATION_HOLD_HOURS ?? 24),
  low_availability_threshold: 4,
  terms_url: "",
  privacy_policy_url: "",
  cancellation_policy_url: "",
  instagram_url: "",
  about_us_text:
    "Cine Respiro nació de una idea simple: el cine se disfruta mejor de cerca. Una sola sala, cupos limitados y una función al día para que cada proyección se sienta íntima — como ver una película en la sala de tu casa, pero con la pantalla grande, buen café y buena compañía.",
  business_sales_email: process.env.BUSINESS_SALES_EMAIL ?? "",
} as const;

export type SettingsMap = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof SettingsMap;

let cache: { data: SettingsMap; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getSettings(): Promise<SettingsMap> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data;
  }
  const rows = await prisma.setting.findMany();
  const overrides = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...DEFAULT_SETTINGS, ...overrides } as SettingsMap;
  cache = { data: merged, loadedAt: Date.now() };
  return merged;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const settings = await getSettings();
  return settings[key];
}

export async function updateSettings(patch: Partial<SettingsMap>): Promise<SettingsMap> {
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      })
    )
  );
  cache = null;
  return getSettings();
}

/** Solo para pruebas / procesos de un solo tiro que no quieren depender del TTL de caché. */
export function invalidateSettingsCache() {
  cache = null;
}
