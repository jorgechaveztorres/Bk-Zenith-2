import 'dart:developer' as developer;

enum LogLevel {
  trace,
  debug,
  info,
  warning,
  error,
  critical,
}

class AppLogger {
  static void log(LogLevel level, String message, {Object? error, StackTrace? stackTrace}) {
    final levelName = level.name.toUpperCase();
    final logMessage = '[ZÉNITH-$levelName] ${DateTime.now().toIso8601String()}: $message';
    
    developer.log(
      message,
      name: 'ZÉNITH',
      level: _getLogLevelInt(level),
      error: error,
      stackTrace: stackTrace,
    );
    
    final color = _getLogLevelColor(level);
    final reset = '\x1B[0m';
    
    // Encapulated and structured output
    // ignore: avoid_print
    print('$color$logMessage$reset');
    if (error != null) {
      // ignore: avoid_print
      print('$color[ERROR DETAILS]: $error$reset');
    }
  }

  static void trace(String message) => log(LogLevel.trace, message);
  static void debug(String message) => log(LogLevel.debug, message);
  static void info(String message) => log(LogLevel.info, message);
  static void warning(String message) => log(LogLevel.warning, message);
  static void error(String message, {Object? error, StackTrace? stackTrace}) => 
      log(LogLevel.error, message, error: error, stackTrace: stackTrace);
  static void critical(String message, {Object? error, StackTrace? stackTrace}) => 
      log(LogLevel.critical, message, error: error, stackTrace: stackTrace);

  static int _getLogLevelInt(LogLevel level) {
    switch (level) {
      case LogLevel.trace: return 0;
      case LogLevel.debug: return 100;
      case LogLevel.info: return 200;
      case LogLevel.warning: return 300;
      case LogLevel.error: return 400;
      case LogLevel.critical: return 500;
    }
  }

  static String _getLogLevelColor(LogLevel level) {
    switch (level) {
      case LogLevel.trace: return '\x1B[37m'; // White
      case LogLevel.debug: return '\x1B[36m'; // Cyan
      case LogLevel.info: return '\x1B[32m'; // Green
      case LogLevel.warning: return '\x1B[33m'; // Yellow
      case LogLevel.error: return '\x1B[31m'; // Red
      case LogLevel.critical: return '\x1B[35m'; // Magenta
    }
  }
}
