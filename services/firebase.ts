
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";
import { RawSubscriptionRow } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBLEHqnZb6gar66twIoOYlFI_xpOqxrRJw",
  authDomain: "cohort-adveasy.firebaseapp.com",
  databaseURL: "https://cohort-adveasy-default-rtdb.firebaseio.com",
  projectId: "cohort-adveasy",
  storageBucket: "cohort-adveasy.firebasestorage.app",
  messagingSenderId: "971211059640",
  appId: "1:971211059640:web:09cecbb1a3fff115d51f4d",
  measurementId: "G-WMZZ7TGH3J"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get Database instance with explicit URL to avoid resolution issues
const db = getDatabase(app, firebaseConfig.databaseURL);

export const saveLastImport = async (data: RawSubscriptionRow[]) => {
  try {
    const dataRef = ref(db, 'globalLastImport');
    await set(dataRef, {
      timestamp: new Date().toISOString(),
      content: data
    });
    console.log("Sincronização global concluída com sucesso.");
    return true;
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    return false;
  }
};

export const loadLastImport = async (): Promise<RawSubscriptionRow[] | null> => {
  try {
    const dataRef = ref(db, 'globalLastImport/content');
    const snapshot = await get(dataRef);
    if (snapshot.exists()) {
      const val = snapshot.val();
      // Handle cases where Firebase returns an object instead of an array
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.values(val) as RawSubscriptionRow[];
      }
      return val as RawSubscriptionRow[];
    }
    return null;
  } catch (error) {
    console.error("Erro ao carregar do Firebase:", error);
    throw error;
  }
};
