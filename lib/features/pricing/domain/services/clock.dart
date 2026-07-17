/// {@template clock}
/// Abstracción del tiempo para evitar dependencias directas con [DateTime.now].
/// Permite simular y controlar el flujo de tiempo de forma determinista en pruebas unitarias.
/// {@endtemplate}
abstract class Clock {
  /// Devuelve la fecha y hora actual en la zona de tiempo requerida (preferiblemente UTC).
  DateTime now();
}

/// {@template server_clock}
/// Implementación de producción que utiliza el reloj del sistema en formato UTC.
/// {@endtemplate}
class ServerClock implements Clock {
  /// {@macro server_clock}
  const ServerClock();

  @override
  DateTime now() => DateTime.now().toUtc();
}

/// {@template clock_provider}
/// Proveedor estático de acceso al reloj global de la aplicación.
/// Facilita la inyección y el mocking del tiempo.
/// {@endtemplate}
class ClockProvider {
  ClockProvider._();

  static Clock _instance = const ServerClock();

  /// Devuelve la instancia activa del reloj.
  static Clock get instance => _instance;

  /// Cambia la instancia activa del reloj (útil para pruebas unitarias).
  static void setMockClock(Clock mockClock) {
    _instance = mockClock;
  }

  /// Restablece el reloj por defecto de producción.
  static void reset() {
    _instance = const ServerClock();
  }

  /// Facilidad de acceso directo a la fecha y hora actual según el reloj configurado.
  static DateTime now() => _instance.now();
}
