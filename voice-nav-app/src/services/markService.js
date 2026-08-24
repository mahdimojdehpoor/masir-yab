// نشانه‌ها (Marks) در Firestore ذخیره می‌شن تا با بستن برنامه پاک نشن
// توجه: چون سیستم حساب کاربری نداریم، این نشانه‌ها بین همه‌ی کاربران اپ مشترکه (مثل گزارش تصادف/پلیس)
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export function listenToMarks(callback) {
  return onSnapshot(
    collection(db, "marks"),
    (snapshot) => {
      const marks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(marks);
    },
    (error) => {
      console.log("Firestore marks listen error:", error.message);
      callback([]);
    }
  );
}

export async function addMark(name, location) {
  try {
    await addDoc(collection(db, "marks"), {
      name: name || "بدون‌نام",
      location,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("addMark failed:", e.message);
  }
}

export async function deleteMark(id) {
  try {
    await deleteDoc(doc(db, "marks", id));
  } catch (e) {
    console.log("deleteMark failed:", e.message);
  }
}
