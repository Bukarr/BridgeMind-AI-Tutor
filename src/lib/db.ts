import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface BridgeMindDB extends DBSchema {
  sessions: {
    key: string;
    value: {
      id: string;
      topic: string;
      subject: string;
      curriculum: string;
      language: string;
      messages: any[];
      timestamp: number;
      updatedAt: number;
    };
    indexes: { 'by-updated': number };
  };
  profiles: {
    key: string;
    value: any;
  };
  daily_cache: {
    key: string;
    value: {
      date: string;
      greeting: string;
      focusTopic: any;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<BridgeMindDB>>;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<BridgeMindDB>('bridgemind-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-updated', 'updatedAt');
          db.createObjectStore('daily_cache', { keyPath: 'date' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};
