// منطق ۴ معیاره: کوتاه‌ترین / خلوت‌ترین / پرامکانات‌ترین / ترکیبی(پیش‌فرض)
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const REPORT_DELAY_SECONDS = 180; // هر گزارش نزدیک مسیر این‌قدر به زمان تخمینی اضافه می‌کنه

export const ROUTE_COLORS = {
  shortest: "#1e90ff",   // آبی
  quietest: "#e53935",   // قرمز
  amenities: "#8e24aa",  // بنفش
  combined: "#43a047",   // سبز
};

export async function getRouteOptions(origin, destination, activeReports) {
  try {
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_URL}/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
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
        distance: r.distance,
        baseDuration: r.duration,
        steps: r.legs[0].steps,
      };
    });

    // امتیاز خلوتی: تأخیر ناشی از گزارش‌های فعال نزدیک مسیر
    const withBusy = routesRaw.map((r) => {
      const nearbyReports = countNearbyReports(r.points, activeReports);
      const estimatedDuration = r.baseDuration + nearbyReports * REPORT_DELAY_SECONDS;
      return { ...r, nearbyReports, estimatedDuration };
    });

    // امتیاز امکانات: تعداد POI نزدیک هر مسیر (بهترین تلاش، اگر Overpass جواب نداد صفر می‌مونه)
    const withAmenities = await Promise.all(
      withBusy.map(async (r) => {
        const amenityCount = await countAmenitiesSafe(r.points);
        return { ...r, amenityCount };
      })
    );

    const shortest = [...withAmenities].sort((a, b) => a.distance - b.distance)[0];
    const quietest = [...withAmenities].sort(
      (a, b) => a.estimatedDuration - b.estimatedDuration
    )[0];
    const amenities = [...withAmenities].sort(
      (a, b) => b.amenityCount - a.amenityCount
    )[0];
    const combined = pickCombined(withAmenities);

    return {
      shortest: { ...shortest, color: ROUTE_COLORS.shortest, key: "shortest" },
      quietest: { ...quietest, color: ROUTE_COLORS.quietest, key: "quietest" },
      amenities: { ...amenities, color: ROUTE_COLORS.amenities, key: "amenities" },
      combined: { ...combined, color: ROUTE_COLORS.combined, key: "combined" },
      all: withAmenities,
    };
  } catch (err) {
    console.log("Routing error:", err.message);
    throw err;
  }
}

function pickCombined(routes) {
  const maxDist = Math.max(...routes.map((r) => r.distance), 1);
  const maxDur = Math.max(...routes.map((r) => r.estimatedDuration), 1);
  const maxAmenity = Math.max(...routes.map((r) => r.amenityCount), 1);

  let best = routes[0];
  let bestScore = Infinity;

  for (const r of routes) {
    const normDist = r.distance / maxDist;
    const normDur = r.estimatedDuration / maxDur;
    const normAmenity = 1 - r.amenityCount / maxAmenity; // بیشتر بهتره، پس معکوس می‌کنیم
    const score = normDist * 0.34 + normDur * 0.33 + normAmenity * 0.33;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
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

// شمارش امکانات (پمپ‌بنزین، رستوران، کافه) با Overpass API — اگر شکست خورد صفر برمی‌گردونه (کرش نمی‌کنه)
async function countAmenitiesSafe(routePoints) {
  try {
    const sample = routePoints.filter((_, i) => i % Math.ceil(routePoints.length / 8) === 0);
    const around = sample
      .map((p) => `node(around:250,${p.latitude},${p.longitude})[amenity~"fuel|restaurant|cafe|hospital"];`)
      .join("");
    const query = `[out:json][timeout:10];(${around});out count;`;

    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query,
    });
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
