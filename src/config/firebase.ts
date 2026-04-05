import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Load the service account key from the root of the backend folder
// The user needs to provide this file as 'firebase-service-account.json'
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

if (!admin.apps.length) {
  try {
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️ [Firebase] Service account file missing at:', serviceAccountPath);
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      console.log('🟢 [Firebase] Admin initialized successfully');
    }
  } catch (error: any) {
    console.error('🔴 [Firebase] Initialization FAILED:', error.message);
  }
}

export const auth = admin.auth();
