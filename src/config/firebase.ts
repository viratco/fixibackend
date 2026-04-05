import * as admin from 'firebase-admin';
import path from 'path';

// Load the service account key from the root of the backend folder
// The user needs to provide this file as 'firebase-service-account.json'
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
  console.log('🟢 [Firebase] Admin initialized');
} catch (error) {
  console.error('🔴 [Firebase] Initialization failed:', error);
  console.info('👉 Make sure "firebase-service-account.json" exists in the backend root.');
}

export const auth = admin.auth();
