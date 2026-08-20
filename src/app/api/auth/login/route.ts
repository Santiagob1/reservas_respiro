import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleApiError } from "@/lib/api-response";
import { verifyPassword, signSessionToken, setSessionCookie } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    const admin = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!admin || !admin.active) {
      return fail("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
    }

    const valid = await verifyPassword(body.password, admin.passwordHash);
    if (!valid) {
      return fail("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
    }

    const token = await signSessionToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
    await setSessionCookie(token);

    return ok({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  } catch (error) {
    return handleApiError(error);
  }
}
