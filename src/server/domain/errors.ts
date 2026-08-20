/**
 * Errores de dominio tipados. Cada uno lleva un código estable (usado por el
 * frontend para decidir el mensaje humano a mostrar) y el status HTTP con el
 * que debe responder la API.
 */
export class DomainError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export class InsufficientCapacityException extends DomainError {
  constructor(available: number) {
    super(
      "INSUFFICIENT_CAPACITY",
      available > 0
        ? `Solo quedan ${available} cupo${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"}.`
        : "Lo sentimos, esta función acaba de completar su capacidad. Selecciona otra función.",
      409
    );
  }
}

export class ShowtimeNotAvailableException extends DomainError {
  constructor(message = "Esta función ya no está disponible para reservar.") {
    super("SHOWTIME_NOT_AVAILABLE", message, 409);
  }
}

export class ShowtimeNotFoundException extends DomainError {
  constructor() {
    super("SHOWTIME_NOT_FOUND", "No encontramos esa función.", 404);
  }
}

export class ReservationNotFoundException extends DomainError {
  constructor() {
    super("RESERVATION_NOT_FOUND", "No encontramos una reserva con esos datos.", 404);
  }
}

export class ReservationExpiredException extends DomainError {
  constructor() {
    super(
      "RESERVATION_EXPIRED",
      "El tiempo para completar esta reserva terminó. Los cupos han sido liberados.",
      410
    );
  }
}

export class InvalidReservationStateException extends DomainError {
  constructor(message = "Esta reserva no puede modificarse en su estado actual.") {
    super("INVALID_RESERVATION_STATE", message, 409);
  }
}

export class PaymentFailedException extends DomainError {
  constructor(message = "No pudimos completar el pago. No se realizó ningún cobro confirmado.") {
    super("PAYMENT_FAILED", message, 402);
  }
}

export class PaymentAlreadyProcessedException extends DomainError {
  constructor() {
    super("PAYMENT_ALREADY_PROCESSED", "Este pago ya fue procesado anteriormente.", 200);
  }
}

export class PaymentGatewayUnavailableException extends DomainError {
  constructor() {
    super(
      "PAYMENT_GATEWAY_UNAVAILABLE",
      "El servicio de pago no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      503
    );
  }
}

export class UnauthorizedException extends DomainError {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ValidationException extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class CapacityBelowCommittedException extends DomainError {
  constructor(committed: number) {
    super(
      "CAPACITY_BELOW_COMMITTED",
      `No puedes establecer una capacidad inferior a los ${committed} cupos actualmente comprometidos.`,
      409
    );
  }
}

export class MovieHasReservationsException extends DomainError {
  constructor() {
    super(
      "MOVIE_CHANGE_BLOCKED",
      "No puedes cambiar libremente la película porque existen reservas asociadas.",
      409
    );
  }
}

export class AlreadyCheckedInException extends DomainError {
  constructor(checkedInAt: Date) {
    super(
      "ALREADY_CHECKED_IN",
      `Esta reserva registró ingreso anteriormente (${checkedInAt.toLocaleString("es-CO")}).`,
      409
    );
  }
}
