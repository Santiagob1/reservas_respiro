import crypto from "crypto";
import QRCode from "qrcode";

const SECRET = process.env.QR_SIGNING_SECRET;

function getSecret(): string {
  if (!SECRET || SECRET.length < 16) {
    throw new Error("QR_SIGNING_SECRET no está configurado correctamente.");
  }
  return SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Genera un token firmado (HMAC-SHA256) que identifica una reserva sin
 * exponer datos sensibles: solo el ID de la reserva + firma. El backend
 * verifica la firma antes de confiar en el ID al escanear el QR.
 */
export function generateQrToken(reservationId: string): string {
  const payload = base64url(reservationId);
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyQrToken(token: string): { reservationId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const reservationId = Buffer.from(payload, "base64url").toString("utf8");
    return { reservationId };
  } catch {
    return null;
  }
}

export async function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#1b120c", light: "#f4e9d8" },
  });
}
