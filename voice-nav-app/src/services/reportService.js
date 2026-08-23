// گزارش تصادف و پلیس + تأیید/تکذیب + حذف خودکار در صورت تکذیب
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const DENY_THRESHOLD = 3; // بعد از ۳ تکذیبِ خالص، گزارش حذف می‌شود

export function listenToReports(type, callback) {
  // type: "crash" | "police"
  return onSnapshot(
    collection(db, type),
    (snapshot) => {
      const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(reports);
    },
    (error) => {
      // در صورت قطعی اتصال (مثلاً نوسان فیلترشکن)، اپ نترکه؛ فقط لیست خالی برگردون
      console.log("Firestore listen error:", error.message);
      callback([]);
    }
  );
}

export async function addReport(type, location) {
  try {
    await addDoc(collection(db, type), {
      location,
      confirmCount: 1,
      denyCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("addReport failed:", e.message);
  }
}

export async function confirmReport(type, reportId, currentConfirm) {
  try {
    await updateDoc(doc(db, type, reportId), {
      confirmCount: currentConfirm + 1,
    });
  } catch (e) {
    console.log("confirmReport failed:", e.message);
  }
}

export async function denyReport(type, reportId, currentDeny) {
  try {
    const newDeny = currentDeny + 1;
    if (newDeny >= DENY_THRESHOLD) {
      await deleteDoc(doc(db, type, reportId));
    } else {
      await updateDoc(doc(db, type, reportId), { denyCount: newDeny });
    }
  } catch (e) {
    console.log("denyReport failed:", e.message);
  }
}
