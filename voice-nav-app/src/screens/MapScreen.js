import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";

import ActionSheet from "../components/ActionSheet";
import ReportBadge from "../components/ReportBadge";
import CategoryBar from "../components/CategoryBar";
import Signature from "../components/Signature";
import { getMapHtml } from "../utils/mapHtml";
import { getRouteOptions, ROUTE_COLORS } from "../services/routingService";
import {
  listenToReports,
  addReport,
  confirmReport,
  denyReport,
} from "../services/reportService";
import { listenToCameras, checkCameraAlerts } from "../services/cameraService";
import { searchNearby } from "../services/poiService";
import { speak } from "../services/voiceService";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

export default function MapScreen() {
  const webviewRef = useRef(null);
  const mapReadyRef = useRef(false);
  const hasCenteredRef = useRef(false);
  const searchFocusedRef = useRef(false); // وقتی کاربر داره تایپ می‌کنه، آپدیت نقشه رو موقتاً نگه می‌داریم

  // HTML نقشه فقط یک‌بار ساخته می‌شه تا WebView مدام ری‌لود نشه
  const mapHtmlContent = useMemo(() => getMapHtml(), []);

  const [myLocation, setMyLocation] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [activeMethods, setActiveMethods] = useState(["combined"]);

  const [crashReports, setCrashReports] = useState([]);
  const [policeReports, setPoliceReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [marks, setMarks] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);

  const [activeCategory, setActiveCategory] = useState(null);
  const [poiResults, setPoiResults] = useState([]);
  const [loadingCategory, setLoadingCategory] = useState(false);

  const [mapMode, setMapMode] = useState("street");

  // موقعیت اولیه‌ی GPS
  useEffect(() => {
    let sub;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const current = await Location.getCurrentPositionAsync({});
        const loc = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setMyLocation(loc);

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 15 },
          (l) => {
            const speedKmh = (l.coords.speed || 0) * 3.6;
            checkCameraAlerts(
              { latitude: l.coords.latitude, longitude: l.coords.longitude },
              speedKmh,
              cameras
            );
            // اگه کاربر داره تایپ می‌کنه، فعلاً موقعیت رو آپدیت نکن تا کیبورد نپره
            if (!searchFocusedRef.current) {
              setMyLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude });
            }
          }
        );
      } catch (e) {
        console.log("Location error:", e.message);
      }
    })();

    const unsubCrash = listenToReports("crash", setCrashReports);
    const unsubPolice = listenToReports("police", setPoliceReports);
    const unsubCam = listenToCameras(setCameras);

    return () => {
      sub && sub.remove();
      unsubCrash();
      unsubPolice();
      unsubCam();
    };
  }, [cameras]);

  // فقط یک‌بار، وقتی GPS واقعی رسید و نقشه آماده بود
  useEffect(() => {
    if (myLocation && mapReadyRef.current && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      webviewRef.current?.injectJavaScript(
        `flyTo(${myLocation.latitude}, ${myLocation.longitude}, 16); true;`
      );
    }
  }, [myLocation]);

  // آپدیت داده‌های نقشه — اگه کاربر داره تایپ می‌کنه، صبر می‌کنیم
  useEffect(() => {
    if (!mapReadyRef.current) return;
    if (searchFocusedRef.current) return;
    const payload = {
      myLocation,
      origin,
      destination,
      marks,
      cameras: safeFilter(cameras),
      crashReports: safeFilter(crashReports),
      policeReports: safeFilter(policeReports),
      poiResults: safeFilter(poiResults),
      routeSegments: buildPolylines(),
    };
    webviewRef.current?.injectJavaScript(
      `updateData(${JSON.stringify(payload)}); true;`
    );
  }, [myLocation, origin, destination, marks, cameras, crashReports, policeReports, poiResults, routes, activeMethods]);

  // سوییچ حالت نقشه
  useEffect(() => {
    if (!mapReadyRef.current) return;
    webviewRef.current?.injectJavaScript(`setTileLayer('${mapMode}'); true;`);
  }, [mapMode]);

  function safeFilter(arr) {
    return arr.filter((item) => item.location && typeof item.location.longitude === "number");
  }

  const goToMyLocation = () => {
    if (myLocation) {
      webviewRef.current?.injectJavaScript(
        `flyTo(${myLocation.latitude}, ${myLocation.longitude}, 16); true;`
      );
    } else {
      speak("موقعیت هنوز دریافت نشده");
    }
  };

  // محاسبه‌ی مسیرها
  useEffect(() => {
    if (origin && destination) {
      const activeReports = [...crashReports, ...policeReports];
      getRouteOptions(origin, destination, activeReports)
        .then((options) => {
          setRoutes(options);
          speak("مسیرهای پیشنهادی آماده شد");
        })
        .catch(() => speak("مشکلی در محاسبه‌ی مسیر پیش آمد، اتصال اینترنت را چک کنید"));
    }
  }, [origin, destination, crashReports, policeReports]);

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

  // جستجوی مکان — محدوده رو دور موقعیت خودمون می‌بندیم تا نتایج شهر درست بیاد، نه شهر دیگه با اسم مشابه
  const search = async () => {
    if (!searchQuery.trim()) return;
    try {
      const center = myLocation || { latitude: 35.6892, longitude: 51.389 };
      const delta = 1.5; // حدود ۱۶۰ کیلومتر اطراف موقعیت فعلی
      const viewbox = `${center.longitude - delta},${center.latitude + delta},${center.longitude + delta},${center.latitude - delta}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&limit=20&countrycodes=ir&viewbox=${viewbox}&bounded=0`;
      const res = await fetchWithTimeout(url, { headers: { "User-Agent": "VoiceNavApp" } }, 8000, 2);
      const data = await res.json();
      if (data.length > 0) {
        let best = data[0];
        let bestDist = Infinity;
        for (const item of data) {
          const p = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
          const d = distanceMeters(center, p);
          if (d < bestDist) {
            bestDist = d;
            best = item;
          }
        }
        const point = {
          latitude: parseFloat(best.lat),
          longitude: parseFloat(best.lon),
        };
        setPendingPoint(point);
        setSheetVisible(true);
        webviewRef.current?.injectJavaScript(
          `flyTo(${point.latitude}, ${point.longitude}, 15); true;`
        );
      } else {
        speak("موردی پیدا نشد");
      }
    } catch {
      speak("جستجو با خطا مواجه شد، اتصال اینترنت را چک کنید");
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready") {
        mapReadyRef.current = true;
      } else if (msg.type === "longpress") {
        setPendingPoint({ latitude: msg.lat, longitude: msg.lng });
        setSheetVisible(true);
      } else if (msg.type === "marker") {
        if (msg.kind === "crash") {
          const r = crashReports.find((x) => x.id === msg.id);
          if (r) setSelectedReport({ type: "crash", report: r });
        } else if (msg.kind === "police") {
          const r = policeReports.find((x) => x.id === msg.id);
          if (r) setSelectedReport({ type: "police", report: r });
        } else if (msg.kind === "poi") {
          const p = poiResults.find((x) => x.id === msg.id);
          if (p) {
            setPendingPoint(p.location);
            setSheetVisible(true);
          }
        }
      }
    } catch (e) {
      console.log("WebView message parse error:", e.message);
    }
  };

  const handleSheetSelect = (action) => {
    if (!pendingPoint) return;
    if (action === "origin") setOrigin(pendingPoint);
    else if (action === "destination") setDestination(pendingPoint);
    else if (action === "mark") setMarks((m) => [...m, pendingPoint]);
    else if (action === "crash") addReport("crash", pendingPoint);
    else if (action === "police") addReport("police", pendingPoint);
  };

  const toggleMethod = (key) => {
    setActiveMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCategorySelect = async (categoryKey) => {
    setActiveCategory(categoryKey);
    if (!categoryKey) {
      setPoiResults([]);
      return;
    }
    setLoadingCategory(true);
    const center = myLocation || origin || { latitude: 35.6892, longitude: 51.389 };
    const results = await searchNearby(categoryKey, center);
    setLoadingCategory(false);
    setPoiResults(results);
    if (results.length === 0) {
      speak("موردی در این نزدیکی پیدا نشد");
    }
  };

  const buildPolylines = useCallback(() => {
    if (!routes || activeMethods.length === 0) return [];

    const selected = activeMethods.map((k) => routes[k]).filter(Boolean);
    if (selected.length === 0) return [];

    if (selected.length === 1) {
      return [{ points: selected[0].points, color: selected[0].color }];
    }

    const OVERLAP_METERS = 60;
    const base = selected[0];

    const flagged = base.points.map((p) => {
      const isShared = selected.slice(1).every((other) =>
        other.points.some((op) => distanceMeters(p, op) < OVERLAP_METERS)
      );
      return { point: p, shared: isShared };
    });

    const segments = [];
    let currentColor = null;
    let currentPoints = [];

    flagged.forEach((r) => {
      const color = r.shared ? "#2e7d32" : base.color;
      if (color !== currentColor) {
        if (currentPoints.length > 1) segments.push({ points: currentPoints, color: currentColor });
        currentColor = color;
        currentPoints = [r.point];
      } else {
        currentPoints.push(r.point);
      }
    });
    if (currentPoints.length > 1) segments.push({ points: currentPoints, color: currentColor });

    selected.slice(1).forEach((r) => {
      segments.push({ points: r.points, color: r.color });
    });

    return segments;
  }, [routes, activeMethods]);

  const methodOptions = [
    { key: "quietest", label: "خلوت‌ترین" },
    { key: "shortest", label: "کوتاه‌ترین" },
    { key: "amenities", label: "پرامکانات‌ترین" },
    { key: "combined", label: "ترکیبی" },
  ];

  const mapModeOptions = [
    { key: "street", label: "خیابانی" },
    { key: "satellite", label: "ماهواره‌ای" },
    { key: "topo", label: "توپوگرافی" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="جستجوی مکان..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={search}
          onFocus={() => {
            searchFocusedRef.current = true;
          }}
          onBlur={() => {
            searchFocusedRef.current = false;
          }}
        />
        <TouchableOpacity onPress={search} style={styles.searchBtn}>
          <Text style={{ color: "#fff" }}>جستجو</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.methodRow}>
        {methodOptions.map((m) => {
          const active = activeMethods.includes(m.key);
          return (
            <TouchableOpacity key={m.key} onPress={() => toggleMethod(m.key)} style={styles.checkboxRow}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: ROUTE_COLORS[m.key] },
                  active && { backgroundColor: ROUTE_COLORS[m.key] },
                ]}
              />
              <Text style={{ color: ROUTE_COLORS[m.key], fontSize: 12 }}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.mapModeRow}>
        {mapModeOptions.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            onPress={() => setMapMode(mode.key)}
            style={[styles.mapModeBtn, mapMode === mode.key && styles.mapModeBtnActive]}
          >
            <Text style={[styles.mapModeText, mapMode === mode.key && styles.mapModeTextActive]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

      {loadingCategory && (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>در حال جستجو...</Text>
        </View>
      )}

      <View style={styles.mapWrap}>
        <WebView
          ref={webviewRef}
          originWhitelist={["*"]}
          source={{ html: mapHtmlContent }}
          onMessage={handleWebViewMessage}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          onError={(e) => console.log("WebView error:", e.nativeEvent)}
        />

        <TouchableOpacity style={styles.locateBtn} onPress={goToMyLocation}>
          <Text style={styles.locateBtnText}>📍</Text>
        </TouchableOpacity>
      </View>

      {selectedReport && (
        <ReportBadge
          label={selectedReport.type === "crash" ? "🚗 تصادف" : "👮 ایست پلیس"}
          report={selectedReport.report}
          onConfirm={() => {
            confirmReport(selectedReport.type, selectedReport.report.id, selectedReport.report.confirmCount || 0);
            setSelectedReport(null);
          }}
          onDeny={() => {
            denyReport(selectedReport.type, selectedReport.report.id, selectedReport.report.denyCount || 0);
            setSelectedReport(null);
          }}
          onClose={() => setSelectedReport(null)}
        />
      )}

      <ActionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onSelect={handleSheetSelect} />

      <Signature />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, position: "relative" },
  map: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", padding: 8, paddingTop: 40 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginRight: 6,
    backgroundColor: "#fff",
  },
  searchBtn: { backgroundColor: "#1e90ff", padding: 10, borderRadius: 8 },
  methodRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 2 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 2, marginRight: 4 },
  mapModeRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  mapModeBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  mapModeBtnActive: { backgroundColor: "#1e90ff", borderColor: "#1e90ff" },
  mapModeText: { fontSize: 12, color: "#333" },
  mapModeTextActive: { color: "#fff" },
  loadingRow: { backgroundColor: "#fff", padding: 6, alignItems: "center" },
  loadingText: { fontSize: 12, color: "#888" },
  locateBtn: {
    position: "absolute",
    bottom: 24,
    right: 16,
    backgroundColor: "#fff",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  locateBtnText: { fontSize: 22 },
});
