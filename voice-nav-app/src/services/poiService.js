// جستجوی امکانات (هتل، بیمارستان، پلیس، پمپ‌بنزین، رستوران) با کش در Firestore
import { collection, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // یک هفته اعتبار کش

export const CATEGORIES = {
  hotel: { label: "هتل", tag: "tourism=hotel", icon: "🏨" },
  hospital: { label: "بیمارستان", tag: "amenity=hospital", icon: "🏥" },
  police: { label: "پلیس", tag: "amenity=police", icon: "👮" },
  fuel: { label: "پمپ بنزین", tag: "amenity=fuel", icon: "⛽" },
  restaurant: { label: "رستوران", tag: "amenity=restaurant", icon: "🍽️" },
  pharmacy: { label: "داروخانه", tag: "amenity=pharmacy", icon: "💊" },
};

// گرد کردن مختصات به یک شبکه‌ی ۰.۰۵ درجه‌ای برای کلید کش (تقریباً ۵ کیلومتر)
function cellKey(lat, lng, categoryKey) {
  const cellLat = Math.round(lat / 0.05) * 0.05;
  const cellLng = Math.round(lng / 0.05) * 0.05;
  return `${categoryKey}_${cellLat.toFixed(2)}_${cellLng.toFixed(2)}`;
}

export async function searchNearby(categoryKey, center, radiusMeters = 5000) {
  const category = CATEGORIES[categoryKey];
  if (!category) return [];

  const key = cellKey(center.latitude, center.longitude, categoryKey);

  // ۱. اول کش رو چک کن
  try {
    const cacheRef = doc(db, "poi_cache", key);
    const cached = await getDoc(cacheRef);
    if (cached.exists()) {
      const data = cached.data();
      const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
      if (age < CACHE_TTL_MS && data.items?.length >= 0) {
        return data.items;
      }
    }
  } catch (e) {
    console.log("POI cache read failed:", e.message);
  }

  // ۲. اگر کش نبود یا منقضی بود، از Overpass بگیر
  try {
    const [tagKey, tagVal] = category.tag.split("=");
    const query = `[out:json][timeout:15];node(around:${radiusMeters},${center.latitude},${center.longitude})[${tagKey}=${tagVal}];out body 30;`;
    const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
    const data = await res.json();

    const items = (data.elements || []).map((el) => ({
      id: `${el.id}`,
      name: el.tags?.name || category.label,
      location: { latitude: el.lat, longitude: el.lon },
    }));

    // ۳. نتیجه رو کش کن برای دفعات بعد
    try {
      await setDoc(doc(db, "poi_cache", key), {
        items,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.log("POI cache write failed:", e.message);
    }

    return items;
  } catch (e) {
    console.log("POI search failed:", e.message);
    return []; // هیچ‌وقت کرش نکن، فقط لیست خالی برگردون
  }
}
