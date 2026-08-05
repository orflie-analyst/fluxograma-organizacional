import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjyRLCDff90uoIkdgg6-SMxi1MmGyeMps",
  authDomain: "orflie-fluxograma.firebaseapp.com",
  projectId: "orflie-fluxograma",
  storageBucket: "orflie-fluxograma.firebasestorage.app",
  messagingSenderId: "645541477341",
  appId: "1:645541477341:web:630b390cb4631f5b69d434",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Instância nomeada separada, usada só por admin.html para criar novos usuários
// (createUserWithEmailAndPassword) sem substituir a sessão do admin logado.
export function getAdminCreationApp() {
  const existing = getApps().find((a) => a.name === "admin-creation");
  if (existing) return existing;
  return initializeApp(firebaseConfig, "admin-creation");
}
