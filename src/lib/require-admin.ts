import { UnauthorizedException } from "@/server/domain/errors";

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
}

/**
 * Lee la identidad del admin propagada por el middleware (que ya validó el
 * JWT). Si falta —p.ej. en pruebas que invocan el handler directamente— falla
 * de forma segura en vez de asumir una identidad.
 */
export function requireAdmin(req: Request): AdminIdentity {
  const id = req.headers.get("x-admin-id");
  const email = req.headers.get("x-admin-email");
  const role = req.headers.get("x-admin-role");
  if (!id || !email || !role) {
    throw new UnauthorizedException();
  }
  return { id, email, role };
}
