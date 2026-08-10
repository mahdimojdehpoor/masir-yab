// دوربین‌های سرعت — از یک کالکشن ثابت در Firestore خونده می‌شن
// (خودت لیست دوربین‌ها رو دستی یا با اسکریپت به کالکشن "cameras" اضافه کن)
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { speak } from "./voiceService";

const WARN_DISTANCE_METERS = 400;

export function listenToCameras(callback) {
  return onSnapshot(collection(db, "cameras"), (snapshot) => {
    const cameras = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(cameras);
  });
}

// این تابع رو داخل watchPosition صدا بزن (هر بار موقعیت جدید اومد)
export function checkCameraAlerts(currentLocation, currentSpeedKmh, cameras) {
  for (const cam of cameras) {
    const dist = distanceMeters(currentLocation, cam.location);
    if (dist < WARN_DISTANCE_METERS && currentSpeedKmh > cam.speedLimit) {
      speak(`دوربین سرعت در مسیر، سرعت مجاز ${cam.speedLimit} کیلومتر`);
      return; // یک هشدار در هر چرخه کافیه
    }
  }
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
