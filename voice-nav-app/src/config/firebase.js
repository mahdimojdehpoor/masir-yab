import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDwvrnH-q8L0eYdXEiGEr_V-8lNoNyt_Vo",
  authDomain: "masiryab-android.firebaseapp.com",
  projectId: "masiryab-android",
  storageBucket: "masiryab-android.firebasestorage.app",
  messagingSenderId: "328825942334",
  appId: "1:328825942334:web:0fee43cbf8629adefc7c6f",
  measurementId: "G-YCFDLY2TLX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
