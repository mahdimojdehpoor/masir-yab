import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
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

export default function MapScreen() {
  // موقعیت و مسیر
  const [myLocation, setMyLocation] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState(null); // { shortest, quietest, amenities, combined }
  const [activeMethods, setActiveMethods] = useState(["combined"]); // چک‌باکس‌های فعال

  // گزارش‌ها و دوربین‌ها
  const [crashReports, setCrashReports] = useState([]);
  const [policeReports, setPoliceReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [marks, setMarks] = useState([]);

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

  // محاسبه‌ی مسیرها هروقت مبدأ/مقصد/گزارش‌ها تغییر کنن
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

  // جستجوی مکان با Nominatim
  const search = async () => {
    if (!searchQuery.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "VoiceNavApp" } });
      const data = await res.json();
      if (data.length > 0) {
        setPendingPoint({
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
        setSheetVisible(true);
      } else {
        speak("موردی پیدا نشد");
      }
    } catch {
      speak("جستجو با خطا مواجه شد");
    }
  };

  // لمس طولانی روی نقشه
  const handleLongPress = (e) => {
    setPendingPoint(e.nativeEvent.coordinate);
    setSheetVisible(true);
  };

  // انتخاب از منوی Action Sheet
  const handleSheetSelect = (action) => {
    if (!pendingPoint) return;
    if (action === "origin") setOrigin(pendingPoint);
    else if (action === "destination") setDestination(pendingPoint);
    else if (action === "mark") setMarks((m) => [...m, pendingPoint]);
    else if (action === "crash") addReport("crash", pendingPoint);
    else if (action === "police") addReport("police", pendingPoint);
  };

  // فعال/غیرفعال کردن هر معیار مسیر
  const toggleMethod = (key) => {
    setActiveMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // جستجوی امکانات (هتل، بیمارستان، پلیس و...)
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

  // ساخت خط‌های رنگی مسیر با درنظرگرفتن هم‌پوشانی (اورلپ = سبز)
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
      const color = r.shared ? "#2e7d32" : base.color; // سبز پررنگ برای بخش مشترک
      if (color !== currentColor) {
        if (currentPoints.length > 1) segments.push({ points: currentPoints, color: currentColor });
        currentColor = color;
        currentPoints = [r.point];
      } else {
        currentPoints.push(r.point);
      }
    });
    if (currentPoints.length > 1) segments.push({ points: currentPoints, color: currentColor });

    // بقیه‌ی مسیرهای انتخابی هم کامل رسم می‌شن تا بخش‌های غیرمشترکشون هم دیده بشه
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

      {/* نوار دسته‌بندی امکانات */}
      <CategoryBar activeCategory={activeCategory} onSelect={handleCategorySelect} />

      <MapView
        style={styles.map}
        onLongPress={handleLongPress}
        initialRegion={
          myLocation
            ? { ...myLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : { latitude: 35.6892, longitude: 51.389, latitudeDelta: 0.1, longitudeDelta: 0.1 }
        }
        showsUserLocation
      >
        {origin && <Marker coordinate={origin} pinColor="green" title="مبدأ" />}
        {destination && <Marker coordinate={destination} pinColor="red" title="مقصد" />}

        {marks.map((m, idx) => (
          <Marker key={`mark-${idx}`} coordinate={m} pinColor="gold" title="نشانه" />
        ))}

        {buildPolylines().map((seg, idx) => (
          <Polyline key={idx} coordinates={seg.points} strokeWidth={5} strokeColor={seg.color} />
        ))}

        {cameras.map((c) => (
          <Marker key={c.id} coordinate={c.location} pinColor="orange" title="دوربین سرعت" />
        ))}

        {crashReports.map((r) => (
          <Marker key={r.id} coordinate={r.location} pinColor="black">
            <ReportBadge
              label="🚗 تصادف"
              report={r}
              onConfirm={() => confirmReport("crash", r.id, r.confirmCount || 0)}
              onDeny={() => denyReport("crash", r.id, r.denyCount || 0)}
            />
          </Marker>
        ))}

        {policeReports.map((r) => (
          <Marker key={r.id} coordinate={r.location} pinColor="purple">
            <ReportBadge
              label="👮 ایست پلیس"
              report={r}
              onConfirm={() => confirmReport("police", r.id, r.confirmCount || 0)}
              onDeny={() => denyReport("police", r.id, r.denyCount || 0)}
            />
          </Marker>
        ))}

        {poiResults.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={poi.location}
            pinColor="teal"
            title={poi.name}
            onPress={() => {
              setPendingPoint(poi.location);
              setSheetVisible(true);
            }}
          />
        ))}
      </MapView>

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
});
