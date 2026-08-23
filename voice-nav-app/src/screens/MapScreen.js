import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";

import ActionSheet from "../components/ActionSheet";
import ReportBadge from "../components/ReportBadge";
import CategoryBar from "../components/CategoryBar";
import Signature from "../components/Signature";
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

MapLibreGL.setAccessToken(null);

// استایل نقشه‌ی رایگان و بدون کلید (OpenFreeMap)
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function MapScreen() {
  const cameraRef = useRef(null);
  const hasCenteredRef = useRef(false);

  // موقعیت و مسیر
  const [myLocation, setMyLocation] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [activeMethods, setActiveMethods] = useState(["combined"]);

  // گزارش‌ها و دوربین‌ها
  const [crashReports, setCrashReports] = useState([]);
  const [policeReports, setPoliceReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [marks, setMarks] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null); // { type, report }

  // جستجو
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);

  // امکانات (POI)
  const [activeCategory, setActiveCategory] = useState(null);
  const [poiResults, setPoiResults] = useState([]);

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
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
          (l) => {
            const speedKmh = (l.coords.speed || 0) * 3.6;
            checkCameraAlerts(
              { latitude: l.coords.latitude, longitude: l.coords.longitude },
              speedKmh,
              cameras
            );
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

  // فقط یک‌بار، وقتی موقعیت واقعی GPS رسید، دوربین نقشه رو ببر روی همون نقطه
  // (این جدا از initialCenter هست تا با هر آپدیت GPS نقشه مدام برنگرده و زوم/جابه‌جایی دستی کاربر خراب نشه)
  useEffect(() => {
    if (myLocation && !hasCenteredRef.current && cameraRef.current) {
      hasCenteredRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: [myLocation.longitude, myLocation.latitude],
        zoomLevel: 14,
        animationDuration: 500,
      });
    }
  }, [myLocation]);

  // محاسبه‌ی مسیرها
  useEffect(() => {
    if (origin && destination) {
      const activeReports = [...crashReports, ...policeReports];
      getRouteOptions(origin, destination, activeReports)
        .then((options) => {
          setRoutes(options);
          speak("مسیرهای پیشنهادی آماده شد");
        })
        .catch(() => speak("مشکلی در محاسبه‌ی مسیر پیش آمد"));
    }
  }, [origin, destination, crashReports, policeReports]);

  // جستجوی مکان
  const search = async () => {
    if (!searchQuery.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "VoiceNavApp" } });
      const data = await res.json();
      if (data.length > 0) {
        const point = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
        setPendingPoint(point);
        setSheetVisible(true);
        cameraRef.current?.setCamera({
          centerCoordinate: [point.longitude, point.latitude],
          zoomLevel: 14,
          animationDuration: 800,
        });
      } else {
        speak("موردی پیدا نشد");
      }
    } catch {
      speak("جستجو با خطا مواجه شد");
    }
  };

  // لمس طولانی روی نقشه
  const handleLongPress = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    setPendingPoint({ latitude: lat, longitude: lng });
    setSheetVisible(true);
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
    const center = myLocation || origin || { latitude: 35.6892, longitude: 51.389 };
    const results = await searchNearby(categoryKey, center);
    setPoiResults(results);
    if (results.length === 0) {
      speak("موردی در این نزدیکی پیدا نشد");
    }
  };

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

  // ساخت سگمنت‌های رنگی مسیر (اورلپ = سبز)
  const buildPolylines = useCallback(() => {
    if (!routes || activeMethods.length === 0) return [];

    const selected = activeMethods.map((k) => routes[k]).filter(Boolean);
    if (selected.length === 0) return [];

    if (selected.length === 1) {
      return [{ points: selected[0].points, color: selected[0].color, key: selected[0].key }];
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

  // تبدیل نقاط به GeoJSON برای MapLibre
  const toGeoJSON = (points) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  });

  const methodOptions = [
    { key: "quietest", label: "خلوت‌ترین" },
    { key: "shortest", label: "کوتاه‌ترین" },
    { key: "amenities", label: "پرامکانات‌ترین" },
    { key: "combined", label: "ترکیبی" },
  ];

  const initialCenter = myLocation
    ? [myLocation.longitude, myLocation.latitude]
    : [51.389, 35.6892];

  return (
    <View style={styles.container}>
      {/* کادر جستجوی واحد */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="جستجوی مکان..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={search}
        />
        <TouchableOpacity onPress={search} style={styles.searchBtn}>
          <Text style={{ color: "#fff" }}>جستجو</Text>
        </TouchableOpacity>
      </View>

      {/* چک‌باکس‌های ۴ معیار مسیر */}
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

      <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

      <MapLibreGL.MapView
        style={styles.map}
        styleURL={MAP_STYLE_URL}
        onLongPress={handleLongPress}
        logoEnabled={false}
        attributionEnabled={true}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 13,
          }}
        />

        <MapLibreGL.UserLocation visible={true} />

        {origin && (
          <MapLibreGL.PointAnnotation
            id="origin"
            coordinate={[origin.longitude, origin.latitude]}
          >
            <View style={[styles.dot, { backgroundColor: "#2e7d32" }]} />
          </MapLibreGL.PointAnnotation>
        )}

        {destination && (
          <MapLibreGL.PointAnnotation
            id="destination"
            coordinate={[destination.longitude, destination.latitude]}
          >
            <View style={[styles.dot, { backgroundColor: "#e53935" }]} />
          </MapLibreGL.PointAnnotation>
        )}

        {marks.map((m, idx) => (
          <MapLibreGL.PointAnnotation
            key={`mark-${idx}`}
            id={`mark-${idx}`}
            coordinate={[m.longitude, m.latitude]}
          >
            <View style={[styles.dot, { backgroundColor: "#f9a825" }]} />
          </MapLibreGL.PointAnnotation>
        ))}

        {buildPolylines().map((seg, idx) => (
          <MapLibreGL.ShapeSource key={`route-${idx}`} id={`route-src-${idx}`} shape={toGeoJSON(seg.points)}>
            <MapLibreGL.LineLayer
              id={`route-line-${idx}`}
              style={{ lineColor: seg.color, lineWidth: 5, lineCap: "round", lineJoin: "round" }}
            />
          </MapLibreGL.ShapeSource>
        ))}

        {cameras.map((c) => (
          <MapLibreGL.PointAnnotation
            key={c.id}
            id={`cam-${c.id}`}
            coordinate={[c.location.longitude, c.location.latitude]}
          >
            <View style={[styles.dot, { backgroundColor: "#fb8c00" }]} />
          </MapLibreGL.PointAnnotation>
        ))}

        {crashReports.map((r) => (
          <MapLibreGL.PointAnnotation
            key={r.id}
            id={`crash-${r.id}`}
            coordinate={[r.location.longitude, r.location.latitude]}
            onSelected={() => setSelectedReport({ type: "crash", report: r })}
          >
            <View style={[styles.dot, { backgroundColor: "#000" }]} />
          </MapLibreGL.PointAnnotation>
        ))}

        {policeReports.map((r) => (
          <MapLibreGL.PointAnnotation
            key={r.id}
            id={`police-${r.id}`}
            coordinate={[r.location.longitude, r.location.latitude]}
            onSelected={() => setSelectedReport({ type: "police", report: r })}
          >
            <View style={[styles.dot, { backgroundColor: "#8e24aa" }]} />
          </MapLibreGL.PointAnnotation>
        ))}

        {poiResults.map((poi) => (
          <MapLibreGL.PointAnnotation
            key={poi.id}
            id={`poi-${poi.id}`}
            coordinate={[poi.location.longitude, poi.location.latitude]}
            onSelected={() => {
              setPendingPoint(poi.location);
              setSheetVisible(true);
            }}
          >
            <View style={[styles.dot, { backgroundColor: "#00897b" }]} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {selectedReport && (
        <ReportBadge
          label={selectedReport.type === "crash" ? "🚗 تصادف" : "👮 ایست پلیس"}
          report={selectedReport.report}
          onConfirm={() => {
            confirmReport(
              selectedReport.type,
              selectedReport.report.id,
              selectedReport.report.confirmCount || 0
            );
            setSelectedReport(null);
          }}
          onDeny={() => {
            denyReport(
              selectedReport.type,
              selectedReport.report.id,
              selectedReport.report.denyCount || 0
            );
            setSelectedReport(null);
          }}
          onClose={() => setSelectedReport(null)}
        />
      )}

      <ActionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleSheetSelect}
      />

      <Signature />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
