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
  return onSnapshot(collection(db, type), (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(reports);
  });
}

export async function addReport(type, location) {
  await addDoc(collection(db, type), {
    location,
    confirmCount: 1,
    denyCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function confirmReport(type, reportId, currentConfirm) {
  await updateDoc(doc(db, type, reportId), {
    confirmCount: currentConfirm + 1,
  });
}

export async function denyReport(type, reportId, currentDeny) {
  const newDeny = currentDeny + 1;
  if (newDeny >= DENY_THRESHOLD) {
    await deleteDoc(doc(db, type, reportId));
  } else {
    await updateDoc(doc(db, type, reportId), { denyCount: newDeny });
  }
}
