import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ride, RideStatus, DocumentStatus } from '../types';
import { DriverPresenceService, DriverOnlineStatus } from './DriverPresenceService';
import { DispatchScoreEngine, DispatchScoreResult } from './DispatchScoreEngine';
import { AssignmentRepository, Assignment, AssignmentStatus } from './AssignmentRepository';

export class DispatchEngine {
  /**
   * Ejecuta un ciclo de despacho para una solicitud de viaje específica.
   * Resuelve reasignaciones, expiraciones, equilibra monopolios de cola y crea ofertas bajo Zero-Trust.
   */
  static async runDispatchCycle(rideId: string): Promise<void> {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) return;

    const ride = rideSnap.data() as Ride;
    
    // Solo despachamos si el viaje está en estado de búsqueda
    if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.SEARCHING_DRIVER) {
      return;
    }

    // 1. Obtener todas las asignaciones existentes para este viaje para auditar intentos previos
    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('rideId', '==', rideId)
    );
    const assignmentsSnap = await getDocs(assignmentsQuery);
    const existingAssignments: Assignment[] = [];
    assignmentsSnap.forEach((doc) => {
      existingAssignments.push(doc.data() as Assignment);
    });

    // Detectar si ya hay una asignación activa (OFFERED) y comprobar si expiró
    const activeAssignment = existingAssignments.find(a => a.status === 'OFFERED');
    if (activeAssignment) {
      const now = new Date();
      const expiresAt = new Date(activeAssignment.expiresAt);
      
      if (now > expiresAt) {
        // Ha excedido el temporizador estricto de 15 segundos
        await AssignmentRepository.expireAssignment(activeAssignment.assignmentId);
        // Volvemos a disparar el ciclo recursivo para reasignar inmediatamente
        await this.runDispatchCycle(rideId);
      }
      return;
    }

    // Si hay una asignación ACCEPTED, sincronizamos el viaje y salimos
    const acceptedAssignment = existingAssignments.find(a => a.status === 'ACCEPTED');
    if (acceptedAssignment) {
      await updateDoc(rideRef, {
        status: RideStatus.DRIVER_ASSIGNED,
        driverId: acceptedAssignment.driverId,
        updatedAt: serverTimestamp()
      });
      return;
    }

    // 2. Extraer conductores excluidos (aquellos que ya rechazaron o expiraron este viaje para evitar loops de spam)
    const excludedDriverIds = existingAssignments
      .filter(a => a.status === 'REJECTED' || a.status === 'EXPIRED' || a.status === 'CANCELLED')
      .map(a => a.driverId);

    // 3. Consultar conductores conectados y listos para recibir viajes (AVAILABLE)
    const onlineQuery = query(
      collection(db, 'drivers_online'),
      where('status', '==', 'AVAILABLE')
    );
    const onlineSnap = await getDocs(onlineQuery);
    const availableDrivers: DriverOnlineStatus[] = [];
    
    onlineSnap.forEach((doc) => {
      const driver = doc.data() as DriverOnlineStatus;
      if (!excludedDriverIds.includes(driver.driverId)) {
        availableDrivers.push(driver);
      }
    });

    if (availableDrivers.length === 0) {
      // Registramos en auditoría de despacho que no hay conductores disponibles
      await AssignmentRepository.logDispatchEvent({
        rideId,
        event: 'NO_DRIVERS_AVAILABLE',
        attemptNumber: existingAssignments.length + 1,
        details: 'El motor analizó el perímetro y no localizó conductores aptos u online en el cuadrante.'
      });
      return;
    }

    // 4. Calcular el Dispatch Score para todos los candidatos
    const scoredDrivers: DispatchScoreResult[] = [];
    for (const driver of availableDrivers) {
      // Sincronizar métricas operacionales del conductor desde su perfil de usuario
      const userRef = doc(db, 'users', driver.driverId);
      const userSnap = await getDoc(userRef);
      
      let metrics = {
        recentAcceptanceRate: 0.90,
        recentCancellationRate: 0.05,
        walletDebtRatio: 0.10,
        disciplinaryPoints: 100
      };

      if (userSnap.exists()) {
        const u = userSnap.data();
        // Simulamos el balanceo dinámico de cola y métricas operacionales
        const wallet = u.wallet;
        if (wallet) {
          const debt = wallet.cashDebt || 0;
          metrics.walletDebtRatio = Math.min(1.0, debt / 150); // Límite de deuda de 150 Soles
        }
      }

      // Balanceo inteligente de cola (Cola Inteligente) para evitar monopolio:
      // Restamos puntos de prioridad si el conductor ya tiene viajes completados hoy
      let balancePenalty = 0;
      try {
        const completedTodayQuery = query(
          collection(db, 'assignments'),
          where('driverId', '==', driver.driverId),
          where('status', '==', 'ACCEPTED')
        );
        const completedTodaySnap = await getDocs(completedTodayQuery);
        // Cada viaje aceptado hoy penaliza levemente su score en 2 puntos para dar oportunidad a otros operadores
        balancePenalty = completedTodaySnap.size * 2.0;
      } catch {
        balancePenalty = 0;
      }

      const scoreResult = DispatchScoreEngine.calculateScore(driver, ride.origin, metrics);
      // Aplicar el factor de equidad
      scoreResult.score = Math.max(1.0, scoreResult.score - balancePenalty);
      scoredDrivers.push(scoreResult);
    }

    // 5. Ordenar candidatos de mayor a menor Dispatch Score
    scoredDrivers.sort((a, b) => b.score - a.score);
    const bestCandidate = scoredDrivers[0];

    if (!bestCandidate) {
      return;
    }

    // 6. Oferta del Viaje (Zero-Trust): Bloqueamos preventivamente el estado del conductor a BUSY
    await DriverPresenceService.setBusyState(bestCandidate.driverId, true);

    // Creamos la asignación oficial
    const attemptNumber = existingAssignments.length + 1;
    await AssignmentRepository.createAssignment({
      rideId,
      driverId: bestCandidate.driverId,
      dispatchScore: bestCandidate.score,
      attemptNumber
    });

    // Actualizamos el estado del viaje a SEARCHING_DRIVER para reflejar el estado en el dashboard cliente
    await updateDoc(rideRef, {
      status: RideStatus.SEARCHING_DRIVER,
      driverId: bestCandidate.driverId,
      driverName: bestCandidate.driverName,
      assignmentEngineVersion: 'ZENITH-SMART-DISPATCH-v3.2',
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Despacha la expiración forzada o rechazo manual de un conductor, reactivando su disponibilidad.
   */
  static async handleAssignmentTimeoutOrReject(assignmentId: string, action: 'EXPIRE' | 'REJECT'): Promise<void> {
    const asgRef = doc(db, 'assignments', assignmentId);
    const asgSnap = await getDoc(asgRef);
    if (!asgSnap.exists()) return;

    const asg = asgSnap.data() as Assignment;
    
    // Ponemos al conductor disponible nuevamente
    await DriverPresenceService.setBusyState(asg.driverId, false);

    if (action === 'EXPIRE') {
      await AssignmentRepository.expireAssignment(assignmentId);
    } else {
      await AssignmentRepository.rejectAssignment(assignmentId, 'Rechazo manual del operador desde pantalla.');
    }

    // Re-evaluar despacho del viaje
    await this.runDispatchCycle(asg.rideId);
  }
}
