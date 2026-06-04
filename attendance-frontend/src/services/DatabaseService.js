import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const DB_NAME = 'attendance_offline.db';
const ENCRYPTION_KEY_ID = 'secure_aes_key';

let db = null;
let aesKey = null;

export const DatabaseService = {
  /**
   * Initializes the DB, enables WAL, and sets up AES key.
   */
  init: async () => {
    try {
      // 1. Setup Encryption Key
      aesKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);
      if (!aesKey) {
        // Generate a 32-character random string for the AES key
        let randomKey = '';
        while (randomKey.length < 32) {
          randomKey += Math.random().toString(36).substring(2);
        }
        aesKey = randomKey.substring(0, 32);
        await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, aesKey);
      }

      // 2. Open DB
      db = await SQLite.openDatabaseAsync(DB_NAME);

      // 3. Enable WAL mode (Write-Ahead Logging) for performance
      await db.execAsync('PRAGMA journal_mode = WAL;');

      // 4. Create Tables
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workers (
          worker_id TEXT PRIMARY KEY,
          name TEXT,
          dob TEXT,
          role TEXT,
          department TEXT,
          encrypted_embedding TEXT,
          image_base64 TEXT
        );
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id TEXT NOT NULL,
          worker_name TEXT,
          similarity REAL,
          risk_level TEXT,
          trust_score REAL,
          latitude REAL,
          longitude REAL,
          timestamp TEXT,
          synced INTEGER DEFAULT 0
        );
      `);
      console.log('Offline Database Initialized ✅');
    } catch (e) {
      console.error('Database Init Error:', e);
    }
  },

  /**
   * Encrypt data with AES-256
   */
  encryptData: (data) => {
    if (!aesKey) return null;
    return CryptoJS.AES.encrypt(JSON.stringify(data), aesKey).toString();
  },

  /**
   * Decrypt data with AES-256
   */
  decryptData: (ciphertext) => {
    if (!aesKey || !ciphertext) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, aesKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) {
      console.error('Decryption failed', e);
      return null;
    }
  },

  /**
   * Saves an enrolled worker offline.
   * Extracts embedding, encrypts it, and saves to SQLite.
   */
  saveWorkerLocally: async (worker) => {
    if (!db) await DatabaseService.init();
    
    // Encrypt the 128-d embedding array
    const encryptedEmbedding = DatabaseService.encryptData(worker.embedding);
    
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO workers (worker_id, name, dob, role, department, encrypted_embedding, image_base64) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          worker.worker_id,
          worker.worker_name,
          worker.dob,
          worker.role,
          worker.department,
          encryptedEmbedding,
          worker.image_base64
        ]
      );
      return { success: true };
    } catch (e) {
      console.error('Error saving worker locally', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Retrieves a worker from local DB and decrypts their embedding.
   */
  getWorkerLocally: async (worker_id) => {
    if (!db) await DatabaseService.init();
    try {
      const row = await db.getFirstAsync('SELECT * FROM workers WHERE worker_id = ?', [worker_id]);
      if (!row) return null;

      // Decrypt embedding
      const embedding = DatabaseService.decryptData(row.encrypted_embedding);
      return { ...row, embedding };
    } catch (e) {
      console.error('Error getting worker locally', e);
      return null;
    }
  },

  /**
   * Logs check-in to local SQLite DB.
   */
  logAttendanceLocally: async (record) => {
    if (!db) await DatabaseService.init();
    try {
      await db.runAsync(
        `INSERT INTO attendance (worker_id, worker_name, similarity, risk_level, trust_score, latitude, longitude, timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          record.worker_id,
          record.worker_name,
          record.similarity,
          record.risk_level,
          record.trust_score,
          record.latitude,
          record.longitude,
          new Date().toISOString()
        ]
      );
      return { success: true };
    } catch (e) {
      console.error('Error logging attendance locally', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Fetches all unsynced attendance logs
   */
  getUnsyncedAttendance: async () => {
    if (!db) await DatabaseService.init();
    try {
      return await db.getAllAsync('SELECT * FROM attendance WHERE synced = 0');
    } catch (e) {
      console.error('Error getting unsynced attendance', e);
      return [];
    }
  },
  
  /**
   * Marks a list of IDs as synced
   */
  markSynced: async (ids) => {
    if (!db || !ids || ids.length === 0) return;
    try {
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`, ids);
    } catch (e) {
      console.error('Error marking synced', e);
    }
  }
};
