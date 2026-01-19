
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

// Inicialização Singleton para evitar erros de múltipla inicialização
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * IMPORTANTE: O erro 'Service database is not available' geralmente ocorre quando
 * o SDK do Firebase não consegue registrar o componente do Realtime Database.
 * Passar a databaseURL explicitamente no getDatabase ajuda a mitigar falhas de descoberta.
 */
const db = getDatabase(app, firebaseConfig.databaseURL);

export const saveLastImport = async (data: RawSubscriptionRow[]) => {
  try {
    const dataRef = ref(db, 'globalLastImport');
    await set(dataRef, {
      timestamp: new Date().toISOString(),
      content: data
    });
    console.log("Planilha sincronizada globalmente no Firebase.");
    return true;
  } catch (error) {
    console.error("Erro crítico ao salvar no Firebase:", error);
    return false;
  }
};

export const loadLastImport = async (): Promise<RawSubscriptionRow[] | null> => {
  try {
    const dataRef = ref(db, 'globalLastImport/content');
    const snapshot = await get(dataRef);
    if (snapshot.exists()) {
      return snapshot.val() as RawSubscriptionRow[];
    }
    return null;
  } catch (error) {
    console.error("Erro ao ler do Firebase:", error);
    return null;
  }
};
