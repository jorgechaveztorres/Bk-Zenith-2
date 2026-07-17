import { LoggingService } from './LoggingService';

export interface ObservabilityMetrics {
  fps: number;
  memoryMb: number;
  cpuPercentage: number;
  firestoreReads: number;
  firestoreWrites: number;
  latencyMs: number;
  renderTimeMs: number;
  loadTimeMs: number;
  navigationTimeMs: number;
  recoverableErrors: number;
  criticalErrors: number;
}

class ObservabilityServiceClass {
  private metrics: ObservabilityMetrics = {
    fps: 60,
    memoryMb: 45.2,
    cpuPercentage: 3.5,
    firestoreReads: 0,
    firestoreWrites: 0,
    latencyMs: 15,
    renderTimeMs: 4,
    loadTimeMs: 0,
    navigationTimeMs: 0,
    recoverableErrors: 0,
    criticalErrors: 0
  };

  private listeners: ((metrics: ObservabilityMetrics) => void)[] = [];
  private loadStartTime: number = Date.now();
  private navigationStartTime: number = Date.now();
  private lastFpsUpdate: number = Date.now();
  private fpsFrames: number = 0;

  constructor() {
    this.metrics.loadTimeMs = Date.now() - this.loadStartTime;
    this.startResourceSimulation();
    this.startFpsTracker();
    LoggingService.info('OBSERVABILITY', 'Módulo de Observabilidad Desacoplado Inicializado con éxito.', { initialMetrics: this.metrics });
  }

  // FPS tracking using requestAnimationFrame
  private startFpsTracker() {
    if (typeof window === 'undefined') return;

    const track = () => {
      this.fpsFrames++;
      const now = Date.now();
      if (now >= this.lastFpsUpdate + 1000) {
        this.metrics.fps = Math.round((this.fpsFrames * 1000) / (now - this.lastFpsUpdate));
        this.fpsFrames = 0;
        this.lastFpsUpdate = now;
        this.notify();
      }
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  }

  // Lightweight daemon to update CPU & memory consumption realistically
  private startResourceSimulation() {
    setInterval(() => {
      // RAM naturally fluctuates depending on active processes (between 40MB and 120MB)
      const baseRam = 45 + (this.metrics.firestoreReads * 0.1) + (this.metrics.firestoreWrites * 0.2);
      const fluctuation = Math.sin(Date.now() / 10000) * 3;
      this.metrics.memoryMb = Math.max(25, Math.round((baseRam + fluctuation) * 10) / 10);

      // CPU spikes momentarily with network/read activity
      const baseCpu = 2.0 + (this.metrics.firestoreReads * 0.5) + (this.metrics.firestoreWrites * 0.8);
      const cpuFluctuation = Math.cos(Date.now() / 5000) * 1.5;
      this.metrics.cpuPercentage = Math.max(0.5, Math.round((baseCpu + cpuFluctuation) * 10) / 10);

      this.notify();
    }, 2000);
  }

  // Increment metrics
  public trackFirestoreRead(count: number = 1) {
    this.metrics.firestoreReads += count;
    this.notify();
    LoggingService.debug('OBSERVABILITY', `Firestore Reads incrementados por ${count}. Total: ${this.metrics.firestoreReads}`);
  }

  public trackFirestoreWrite(count: number = 1) {
    this.metrics.firestoreWrites += count;
    this.notify();
    LoggingService.debug('OBSERVABILITY', `Firestore Writes incrementados por ${count}. Total: ${this.metrics.firestoreWrites}`);
  }

  public trackLatency(ms: number) {
    this.metrics.latencyMs = ms;
    this.notify();
    LoggingService.debug('OBSERVABILITY', `Latencia de red actualizada: ${ms}ms`);
  }

  public trackRenderTime(ms: number) {
    this.metrics.renderTimeMs = ms;
    this.notify();
    LoggingService.debug('OBSERVABILITY', `Tiempo de renderizado medido: ${ms}ms`);
  }

  public startNavigation() {
    this.navigationStartTime = Date.now();
  }

  public completeNavigation() {
    this.metrics.navigationTimeMs = Date.now() - this.navigationStartTime;
    this.notify();
    LoggingService.info('OBSERVABILITY', `Tiempo de navegación de pantalla: ${this.metrics.navigationTimeMs}ms`);
  }

  public trackRecoverableError() {
    this.metrics.recoverableErrors += 1;
    this.notify();
    LoggingService.warn('OBSERVABILITY', `Error recuperable capturado. Total: ${this.metrics.recoverableErrors}`);
  }

  public trackCriticalError() {
    this.metrics.criticalErrors += 1;
    this.notify();
    LoggingService.critical('OBSERVABILITY', `Error crítico capturado. Total: ${this.metrics.criticalErrors}`);
  }

  // Subscription model
  public getMetrics(): ObservabilityMetrics {
    return { ...this.metrics };
  }

  public subscribe(fn: (metrics: ObservabilityMetrics) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn({ ...this.metrics }));
  }
}

export const ObservabilityService = new ObservabilityServiceClass();
