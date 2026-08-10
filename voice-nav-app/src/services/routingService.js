// منطق سه‌گانه‌ی مسیر: کوتاه‌ترین / خلوت‌ترین / ترکیبی (پیش‌فرض)
// از OSRM رایگان برای گرفتن مسیرهای جایگزین استفاده می‌کنیم
// و بر اساس گزارش‌های فعال (تصادف/پلیس) در بافر هر مسیر، امتیاز "شلوغی" می‌سازیم

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export async function getRouteOptions(origin, destination, activeReports) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_URL}/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("مسیری پیدا نشد");
  }

  const routes = data.routes.map((r) => {
    const points = r.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const busyScore = calculateBusyScore(points, activeReports);

    return {
      points,
      distance: r.distance, // متر
      duration: r.duration, // ثانیه
      steps: r.legs[0].steps,
      busyScore,
    };
  });

  return {
    shortest: [...routes].sort((a, b) => a.distance - b.distance)[0],
    quietest: [...routes].sort((a, b) => a.busyScore - b.busyScore)[0],
    combined: pickCombined(routes), // پیش‌فرض
    all: routes,
  };
}

// هر چه گزارش فعال (تصادف/پلیس) نزدیک‌تر به مسیر باشد، امتیاز شلوغی بالاتر
function calculateBusyScore(routePoints, reports) {
  const BUFFER_METERS = 300;
  let score = 0;
  for (const report of reports) {
    for (const p of routePoints) {
      if (distanceMeters(p, report.location) < BUFFER_METERS) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

// ترکیب وزنی: نرمال‌سازی فاصله و شلوغی، هرکدام وزن ۵۰٪
function pickCombined(routes) {
  const maxDist = Math.max(...routes.map((r) => r.distance));
  const maxBusy = Math.max(...routes.map((r) => r.busyScore), 1);

  let best = routes[0];
  let bestScore = Infinity;

  for (const r of routes) {
    const normDist = r.distance / maxDist;
    const normBusy = r.busyScore / maxBusy;
    const score = normDist * 0.5 + normBusy * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
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
