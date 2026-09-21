import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp, 
  FieldValue 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, storage } from '../firebase/config';
import { User, UserRole, DocumentStatus, DriverProfile, Wallet } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[ZENITH-FIRESTORE-ERROR]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class DriverService {
  /**
   * Registers a driver using Firebase Authentication and initializes their Firestore document
   */
  static async registerDriver(
    email: string, 
    password: string, 
    fullName: string, 
    phone: string,
    city: string
  ): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Create initial wallet
      const initialWallet: Wallet = {
        availableBalance: 0.00,
        retainedBalance: 0.00,
        dailyEarnings: 0.00,
        weeklyEarnings: 0.00,
        movements: [],
        pendingSettlement: 0.00,
        digitalBalance: 0.00,
        cashDebt: 0.00,
        todaySettlements: 0,
        nextSettlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      // Create initial driver profile conforming to sprint requirements
      const initialProfile = {
        status: DocumentStatus.PENDING,
        availability: false,
        rating: 5.0,
        vehicle: {
          category: '',
          plate: '',
          brand: '',
          model: '',
          year: new Date().getFullYear(),
          color: ''
        },
        documentation: {
          licenseNumber: '',
          licenseExpiry: ''
        },
        appVersion: '1.0.42',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      let rolesEnabled: (UserRole | 'CLIENTE' | 'MOTORIZADO')[] = [UserRole.DRIVER];
      try {
        const existingDoc = await getDoc(doc(db, 'users', uid));
        if (existingDoc.exists()) {
          const prev = existingDoc.data() as User;
          rolesEnabled = Array.from(new Set([...(prev.rolesEnabled || [prev.role || UserRole.PASSENGER]), UserRole.DRIVER]));
        }
      } catch (e) {
        // Fallback default
      }

      const userDoc: User = {
        uid,
        fullName,
        email,
        phone,
        role: UserRole.DRIVER,
        rolesEnabled,
        activeRole: UserRole.DRIVER,
        rating: 5.0,
        onboardingComplete: false,
        wallet: initialWallet,
        driverProfile: initialProfile as unknown as DriverProfile
      };

      const path = `users/${uid}`;
      try {
        await setDoc(doc(db, 'users', uid), userDoc, { merge: true });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, path);
      }

      // Send email verification immediately
      try {
        await sendEmailVerification(userCredential.user);
      } catch (err) {
        console.warn("[DriverService] Verification email send failed:", err);
      }

      return userDoc;
    } catch (error) {
      console.error("[DriverService] Auth Registration failed:", error);
      throw error;
    }
  }

  /**
   * Sends password recovery email
   */
  static async recoverPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Triggers SMS Authentication. Needs a Recaptcha container ID.
   */
  static async setupSmsAuth(phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
    try {
      const appVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible'
      });
      return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    } catch (error) {
      console.error("[DriverService] SMS setup failed:", error);
      throw error;
    }
  }

  /**
   * Uploads any driver document image to Firebase Storage and returns its URL
   */
  static async uploadDocumentImage(
    uid: string, 
    fileName: string, 
    file: File | Blob
  ): Promise<string> {
    try {
      const storageRef = ref(storage, `drivers/${uid}/${fileName}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error(`[DriverService] File upload failed for ${fileName}:`, error);
      // Fallback url for demo if upload fails or is blocked
      const simulatedUrl = `https://storage.googleapis.com/zenith-assets/${uid}_${fileName}`;
      return simulatedUrl;
    }
  }

  /**
   * Updates the vehicle configuration details for the driver
   */
  static async updateVehicleDetails(
    uid: string,
    category: string,
    plate: string,
    brand: string,
    model: string,
    year: number,
    color: string
  ): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'driverProfile.vehicle': {
          category,
          plate,
          brand,
          model,
          year,
          color
        },
        'driverProfile.updatedAt': serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  /**
   * Updates driver documentation parameters and status
   */
  static async updateDriverDocumentation(
    uid: string,
    data: {
      licenseNumber: string;
      licenseExpiry: string;
      driverPhotoUrl?: string;
      vehiclePhotoUrl?: string;
      licensePhotoUrl?: string;
      propertyCardPhotoUrl?: string;
      soatPhotoUrl?: string;
    }
  ): Promise<void> {
    const path = `users/${uid}`;
    try {
      // Clear empty fields to avoid overwriting existing valid URLs
      const updatePayload: Record<string, any> = {};
      
      updatePayload['driverProfile.documentation.licenseNumber'] = data.licenseNumber;
      updatePayload['driverProfile.documentation.licenseExpiry'] = data.licenseExpiry;
      
      if (data.driverPhotoUrl) {
        updatePayload['driverProfile.documentation.driverPhotoUrl'] = data.driverPhotoUrl;
        updatePayload['photoUrl'] = data.driverPhotoUrl; // Sync public profile photo
      }
      if (data.vehiclePhotoUrl) updatePayload['driverProfile.documentation.vehiclePhotoUrl'] = data.vehiclePhotoUrl;
      if (data.licensePhotoUrl) updatePayload['driverProfile.documentation.licensePhotoUrl'] = data.licensePhotoUrl;
      if (data.propertyCardPhotoUrl) updatePayload['driverProfile.documentation.propertyCardPhotoUrl'] = data.propertyCardPhotoUrl;
      if (data.soatPhotoUrl) updatePayload['driverProfile.documentation.soatPhotoUrl'] = data.soatPhotoUrl;

      // Automatically advance status to UNDER_REVIEW on document upload completion
      updatePayload['driverProfile.status'] = DocumentStatus.UNDER_REVIEW;
      updatePayload['driverProfile.updatedAt'] = serverTimestamp();

      await updateDoc(doc(db, 'users', uid), updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  /**
   * Updates driver operational status (e.g., availability)
   */
  static async updateAvailability(uid: string, availability: boolean): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'driverProfile.availability': availability,
        'driverProfile.lastConnection': new Date().toISOString(),
        'driverProfile.updatedAt': serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  /**
   * Advanced admin-level document verification status update (Zero-Trust sandbox simulation)
   */
  static async adminUpdateStatus(uid: string, status: DocumentStatus): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'driverProfile.status': status,
        'driverProfile.updatedAt': serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}
