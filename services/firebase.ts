
import { initializeApp } from "firebase/app";
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const saveLastImport = async (data: RawSubscriptionRow[]) => {
  try {
    const dataRef = ref(db, 'lastImport');
    await set(dataRef, {
      timestamp: new Date().toISOString(),
      content: data
    });
    console.log("Dados sincronizados com Firebase.");
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
  }
};

export const loadLastImport = async (): Promise<RawSubscriptionRow[] | null> => {
  try {
    const dataRef = ref(db, 'lastImport/content');
    const snapshot = await get(dataRef);
    if (snapshot.exists()) {
      return snapshot.val() as RawSubscriptionRow[];
    }
    return null;
  } catch (error) {
    console.error("Erro ao carregar do Firebase:", error);
    return null;
  }
};
