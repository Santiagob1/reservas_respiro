# Cine Respiro — Sistema de Reservas

Software de gestión y reservas para un cine boutique de sala única (15 cupos, una función por día). Cubre venta online, reservas manuales, pagos (online + efectivo/transferencia), control de disponibilidad sin sobreventa, check-in por QR y administración completa de la operación.

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend público, panel admin y API REST en un solo proyecto.
- **PostgreSQL 16** + **Prisma 6** (ORM, migraciones).
- **Tailwind CSS 4** para estilos.
- **Bold** como pasarela de pago principal (Wompi también implementada como alternativa); modo `mock` para desarrollo sin credenciales.
- **Resend** para email transaccional (confirmación al cliente + aviso de venta al negocio).
- **Vitest** para pruebas de integración (incluye la prueba crítica de concurrencia).
- **Docker Compose** para desarrollo/producción (Postgres + app + worker de expiración).

## Arquitectura

```
CLIENTE WEB / ADMIN
        │
        ▼
   Next.js App Router
   ├── app/(public)      páginas públicas (cartelera, wizard de reserva, mi reserva)
   ├── app/admin         panel administrativo (protegido por sesión JWT)
   └── app/api           rutas REST (públicas, /admin, /auth, /cron, /payments/webhook)
        │
        ▼
   server/services        reglas de negocio (Reservation, Availability, Payment, Showtime...)
        │
        ▼
   Prisma Client  ──────►  PostgreSQL
        │
        ▼
   lib/payment-gateway    interfaz PaymentGateway → WompiGateway | MockGateway
```

**Capas**: los route handlers son delgados (parsean/validan con Zod y delegan). Toda la lógica de negocio vive en `src/server/services/*`. Los errores de dominio (`src/server/domain/errors.ts`) se mapean a respuestas HTTP consistentes (`{success, data}` / `{success:false, error:{code,message}}`), sin exponer stack traces.

## Regla de oro: cero sobreventa

Todo canal (web, pago online, reserva manual, efectivo, transferencia, WhatsApp, presencial) pasa por el mismo `ReservationService.createReservation()`, que:

1. Bloquea la fila de la función (`SELECT ... FOR UPDATE`) dentro de una transacción de Postgres.
2. Recalcula la disponibilidad real (capacidad − reservas en estados que bloquean cupo) **en el servidor**, ignorando cualquier dato de disponibilidad enviado por el cliente.
3. Solo si hay cupo, crea la reserva y sus items en la misma transacción.

Además, toda consulta de disponibilidad excluye en la propia query las reservas `PENDING_PAYMENT` ya vencidas, así el sistema nunca depende de que el proceso de expiración ya haya corrido (defensa en profundidad). Ver la prueba `tests/concurrency.test.ts` para la verificación automatizada de este comportamiento con 15 cupos y dos solicitudes simultáneas de 10.

## Modelo de datos (resumen)

```
Movie 1───N Showtime 1───N Reservation N───1 Customer
                              │
                              ├──N ReservationItem N───1 TicketType
                              ├──N Payment N───N PaymentTransaction (log de webhooks)
                              ├──N ReservationStatusHistory
                              └──0..1 CheckIn

AdminUser 1───N AuditLog
Setting (key/value, configuración del negocio)
```

Ver `prisma/schema.prisma` para el detalle completo (enums de estado, índices, restricciones). Nada se borra físicamente: cancelaciones y expiraciones son cambios de estado con historial en `reservation_status_history` y `audit_logs`.

## Puesta en marcha (desarrollo)

### 1. Requisitos

- Node.js 20+
- Docker Desktop (para Postgres)

### 2. Variables de entorno

```bash
cp .env.example .env
```

Revisa `.env` — por defecto usa `PAYMENT_PROVIDER=mock` (no necesitas credenciales de Wompi para desarrollar) y Postgres en `127.0.0.1:5433` (se remapea desde 5432 para no chocar con una instalación local de Postgres).

### 3. Base de datos

```bash
docker compose up -d postgres
npx prisma migrate dev
npm run seed
```

El seed crea: un admin (`admin@cinerespiro.com` / `CambiaEstaClave123!` por defecto, configurable en `.env`), 3 películas demo, 12 funciones (lunes a sábado, 7:00 PM) y los 3 productos (General/Combo/Combo con comida).

### 4. Levantar la app

```bash
npm run dev
```

- Público: http://localhost:3000
- Admin: http://localhost:3000/admin/login

### 5. Worker de expiración (opcional en dev)

Las reservas `PENDING_PAYMENT` vencidas se excluyen de la disponibilidad automáticamente aunque este proceso no esté corriendo, pero para que su **estado** pase a `EXPIRED` (visible en reportes/admin) corre:

```bash
npm run worker
```

o dispara manualmente el endpoint protegido:

```bash
curl -X POST http://localhost:3000/api/cron/expire-reservations -H "x-cron-secret: $CRON_SECRET"
```

## Pruebas

```bash
npm run test
```

Incluye, entre otras: cálculo de precios desde base de datos (nunca desde el cliente), la prueba crítica de concurrencia (15 cupos, 2 solicitudes simultáneas de 10 → solo una gana), expiración automática, cancelación con conservación de historial, check-in de un solo uso con override de admin, idempotencia de webhooks (duplicado no reprocesa, pago rechazado no confirma), y la guarda de capacidad (no se puede bajar por debajo de lo comprometido). Los tests corren contra la misma base de Postgres de Docker Compose, creando y limpiando sus propios datos.

## Docker (todo en contenedores)

```bash
docker compose up -d --build
```

Levanta `postgres`, `app` (corre `prisma migrate deploy` y luego el server) y `worker` (expiración cada minuto). Ajusta `.env` antes de construir.

## Integración de pagos (Bold / Wompi)

La pasarela está detrás de la interfaz `PaymentGateway` (`src/lib/payment-gateway/types.ts`). Cambiar de proveedor es solo la variable `PAYMENT_PROVIDER` — no requiere tocar `reservation.service.ts` ni las rutas de la API.

- **Modo desarrollo**: `PAYMENT_PROVIDER=mock` — el checkout es una página propia (`/pago-simulado/[reservationId]`) con botones "Aprobar"/"Rechazar" que ejercitan el mismo endpoint de webhook que usaría la pasarela real, incluida la idempotencia.

### Bold (`PAYMENT_PROVIDER=bold`)

Variables: `BOLD_API_KEY`, `BOLD_WEBHOOK_SECRET`, `BOLD_API_URL` (`https://integrations.api.bold.co`), `BOLD_VOUCHER_API_URL` (`https://payments.api.bold.co/v2`).

Flujo (`src/lib/payment-gateway/bold.ts`), según [developers.bold.co](https://developers.bold.co):

1. **Checkout**: `POST {BOLD_API_URL}/online/link/v1` (header `Authorization: x-api-key <key>`) crea un link de pago hospedado por Bold; el cliente es redirigido a `url` de la respuesta.
2. **QR Bre-B**: si tu cuenta Bold tiene "QR Pro" activado, el checkout ofrece automáticamente pagar escaneando un QR interoperable con la app de cualquier banco (sistema Bre-B del Banco de la República) — no requiere código adicional de nuestra parte.
3. **Verificación de transacción**: `GET {BOLD_VOUCHER_API_URL}/payment-voucher/{id}`.
4. **Webhook** (`POST /api/payments/webhook`): eventos tipo CloudEvents (`SALE_APPROVED`/`SALE_REJECTED`), firma `HMAC-SHA256(base64(body), BOLD_WEBHOOK_SECRET)` comparada contra el header `x-bold-signature`.

⚠️ La documentación pública de Bold está fragmentada entre varios productos (Link de Pagos, Botón de Pagos, API de Pagos en Línea). Antes de operar en producción, **valida en el sandbox real de tu cuenta Bold** el endpoint de consulta de transacción y los nombres exactos de los campos del webhook — hay comentarios en `bold.ts` señalando esto. También confirma con Bold la tarifa exacta que te cobran por el QR Bre-B en pagos en línea (no es necesariamente la misma que su producto de QR presencial).

### Wompi (`PAYMENT_PROVIDER=wompi`, alternativa ya implementada)

Variables: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_API_URL`. Ver `src/lib/payment-gateway/wompi.ts` — checkout por redirección firmada, verificación de transacción y webhook con checksum `SHA256`, según [docs.wompi.co](https://docs.wompi.co).

### Regla común a ambas

El webhook (`POST /api/payments/webhook`) siempre registra el evento en `payment_transactions` (constraint único → idempotente ante reintentos/duplicados), **vuelve a consultar el estado oficial** de la transacción antes de confirmar (nunca confía solo en el payload del webhook) y verifica que el monto coincida con el de la reserva antes de marcarla `CONFIRMED`. Configura la URL de webhook en el dashboard del proveedor apuntando a `{APP_BASE_URL}/api/payments/webhook`.

## Notificaciones por email (Resend)

`NOTIFICATIONS_PROVIDER=resend` + `RESEND_API_KEY` (ver [resend.com](https://resend.com)). Sin API key configurada, los correos solo se registran en consola (no bloquea el flujo — sección 47).

- **Cliente**: al confirmarse el pago, recibe un correo con el código de reserva y un enlace para ver el detalle + QR.
- **Negocio**: al mismo tiempo, `BUSINESS_SALES_EMAIL` (configurable también desde `/admin/configuración`) recibe un aviso con los datos del cliente y de la venta.

El correo del cliente es ahora un campo obligatorio en el flujo público (antes era opcional) para que esta notificación siempre pueda enviarse.

## Guía de administración

1. Inicia sesión en `/admin/login`.
2. **Dashboard**: función de hoy, ocupación, ingresos, pagos pendientes.
3. **Películas** / **Productos**: CRUD; desactivar en vez de borrar si ya tienen historial asociado.
4. **Funciones**: crea funciones en `DRAFT` y publícalas (individualmente o "Publicar semana") cuando quieras que aparezcan al público. Cerrar reservas o cancelar una función no borra las reservas existentes.
5. **Reservas**: lista y filtra por estado; "+ Reserva manual" para WhatsApp/teléfono/presencial con efectivo, transferencia u otro método — queda `PENDING_PAYMENT` hasta pulsar "Marcar como pagada".
6. **Control de ingreso**: escanea el QR del cliente (cámara) o busca por código; un QR ya usado requiere autorización explícita para reingresar.
7. **Reportes**: reservas/ingresos/entradas por día y por método de pago (últimos 30 días).
8. **Configuración**: nombre del cine, contacto, minutos/horas de bloqueo de cupos, umbral de "últimos cupos", políticas — nada de esto está hardcodeado en el frontend.

## Variables de entorno

Ver `.env.example` para la lista completa y comentada (base de datos, JWT, firma de QR, secreto de cron, minutos/horas de bloqueo de reservas, proveedor de pagos y credenciales de Wompi, notificaciones, credenciales del admin sembrado).

## Estructura del proyecto

```
prisma/schema.prisma       Modelo de datos y migraciones
prisma/seed.ts              Datos demo
src/app/(public)/           Frontend público (wizard de reserva, mi reserva)
src/app/admin/               Panel administrativo
src/app/api/                 API REST (pública, /admin, /auth, /cron, /payments)
src/server/services/         Lógica de negocio
src/server/domain/errors.ts  Excepciones de dominio
src/lib/                     Infraestructura (prisma, auth, qr, timezone, payment-gateway...)
scripts/worker.ts            Proceso de expiración de reservas
tests/                       Pruebas de integración (Vitest)
docker-compose.yml           Postgres + app + worker
```

## Qué queda simulado / pendiente de credenciales reales

- **Wompi**: la integración está completa contra la documentación oficial, pero usa `PAYMENT_PROVIDER=mock` hasta que se configuren credenciales reales de comercio.
- **Email/WhatsApp**: `NotificationService` registra cada notificación con su propio estado (`PENDING/SENT/FAILED`) y por defecto solo las imprime en consola (`NOTIFICATIONS_PROVIDER=console`). El punto de integración para un proveedor real (Resend, SendGrid, Meta Cloud API, etc.) está aislado en `src/server/services/notification.service.ts` y nunca bloquea ni condiciona la confirmación de una reserva.

## Arquitectura preparada para crecer

Aunque el negocio actual es una sola sala/función, el modelo de datos (`Showtime.capacity` independiente por función, `TicketType` como catálogo, `Reservation`/`ReservationItem` desacoplados) permite agregar sin rediseñar: múltiples funciones por día, más salas, selección de asientos, tarifas diferenciadas, cupones o inventario de combos.
