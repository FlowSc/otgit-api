import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      if (admin.apps.length > 0) {
        this.app = admin.app();
        this.logger.log('Using existing Firebase Admin SDK instance');
        return;
      }

      const serviceAccountKey = this.getServiceAccountKey();
      if (!serviceAccountKey) {
        this.logger.warn('Firebase configuration not found, Firebase services will be disabled');
        return;
      }

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: serviceAccountKey.project_id,
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  private getServiceAccountKey(): any {
    const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (serviceAccountJson) {
      try {
        return JSON.parse(serviceAccountJson);
      } catch (error) {
        this.logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
        return null;
      }
    }

    if (serviceAccountPath) {
      try {
        const fullPath = path.resolve(serviceAccountPath);
        return require(fullPath);
      } catch (error) {
        this.logger.error(`Failed to load service account from ${serviceAccountPath}:`, error);
        return null;
      }
    }

    return null;
  }

  getMessaging(): admin.messaging.Messaging | null {
    if (!this.app) {
      this.logger.warn('Firebase app not initialized');
      return null;
    }
    return admin.messaging(this.app);
  }

  getFirestore(): admin.firestore.Firestore | null {
    if (!this.app) {
      this.logger.warn('Firebase app not initialized');
      return null;
    }
    return admin.firestore(this.app);
  }

  getAuth(): admin.auth.Auth | null {
    if (!this.app) {
      this.logger.warn('Firebase app not initialized');
      return null;
    }
    return admin.auth(this.app);
  }

  isInitialized(): boolean {
    return !!this.app;
  }
}