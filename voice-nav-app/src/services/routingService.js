// منطق ۴ معیاره‌ی تعیین مسیر:
// ۱. کوتاه‌ترین: فقط بر اساس مسافت
// ۲. خلوت‌ترین: فقط بر اساس زمان تخمینی رسیدن (با احتساب تأخیر گزارش‌های تصادف/پلیس)
// ۳. پرامکانات‌ترین: کمترین «فاصله تقسیم بر تعداد امکانات» یعنی بیشترین تراکم امکانات
// ۴. ترکیبی: بین مسیرها اول نیمی که کوتاه‌تراند رو نگه می‌داریم، بعد بینشون کمترین زمان رسیدن رو انتخاب می‌کنیم
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const REPORT_DELAY_SECONDS = 180; // هر گزارش نزدیک مسیر این‌قدر به زمان تخمینی اضافه می‌کنه

export const ROUTE_COLORS = {
  shortest: "#1e90ff", // آبی
  quietest: "#e53935", // قرمز
  amenities: "#8e24aa", // بنفش
  combined: "#43a047", // سبز
};

export async function getRouteOptions(origin, destination, activeReports) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_URL}/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;

  const res = await fetchWithTimeout(url, {}, 12000, 1);
  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("مسیری پیدا نشد");
  }

  const routesRaw = data.routes.map((r) => {
    const points = r.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    return {
      points,
      distance: r.distance, // متر
      baseDuration: r.duration, // ثانیه
    };
  });

  const withBusy = routesRaw.map((r) => {
    const nearbyReports = countNearbyReports(r.points, activeReports);
    const estimatedDuration = r.baseDuration + nearbyReports * REPORT_DELAY_SECONDS;
    return { ...r, nearbyReports, estimatedDuration };
  });

  const withAmenities = await Promise.all(
    withBusy.map(async (r) => {
      const amenityCount = await countAmenitiesSafe(r.points);
      // تراکم = فاصله تقسیم بر تعداد امکانات؛ هرچه کمتر یعنی امکانات بیشتری در واحد مسافت داریم
      const density = r.distance / Math.max(amenityCount, 0.5);
      return { ...r, amenityCount, density };
    })
  );

  const shortest = [...withAmenities].sort((a, b) => a.distance - b.distance)[0];
  const quietest = [...withAmenities].sort((a, b) => a.estimatedDuration - b.estimatedDuration)[0];
  const amenities = [...withAmenities].sort((a, b) => a.density - b.density)[0];
  const combined = pickCombined(withAmenities);

  return {
    shortest: { ...shortest, color: ROUTE_COLORS.shortest, key: "shortest" },
    quietest: { ...quietest, color: ROUTE_COLORS.quietest, key: "quietest" },
    amenities: { ...amenities, color: ROUTE_COLORS.amenities, key: "amenities" },
    combined: { ...combined, color: ROUTE_COLORS.combined, key: "combined" },
    all: withAmenities,
  };
}

// اول نیمی از مسیرها که کوتاه‌ترن رو نگه می‌داریم، بعد بینشون کمترین زمان رسیدن رو انتخاب می‌کنیم
function pickCombined(routes) {
  const sortedByDistance = [...routes].sort((a, b) => a.distance - b.distance);
  const halfCount = Math.max(1, Math.ceil(sortedByDistance.length / 2));
  const shortlist = sortedByDistance.slice(0, halfCount);
  return [...shortlist].sort((a, b) => a.estimatedDuration - b.estimatedDuration)[0];
}

function countNearbyReports(routePoints, reports) {
  const BUFFER_METERS = 300;
  let count = 0;
  for (const report of reports) {
    for (const p of routePoints) {
      if (distanceMeters(p, report.location) < BUFFER_METERS) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

async function countAmenitiesSafe(routePoints) {
  try {
    const sample = routePoints.filter((_, i) => i % Math.ceil(routePoints.length / 8) === 0);
    const around = sample
      .map((p) => `node(around:250,${p.latitude},${p.longitude})[amenity~"fuel|restaurant|cafe|hospital"];`)
      .join("");
    const query = `[out:json][timeout:10];(${around});out count;`;

    const res = await fetchWithTimeout(OVERPASS_URL, { method: "POST", body: query }, 10000, 1);
    const data = await res.json();
    return parseInt(data?.elements?.[0]?.tags?.total || "0", 10);
  } catch {
    return 0;
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
