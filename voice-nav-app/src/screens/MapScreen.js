import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";

import SearchBar from "../components/SearchBar";
import Signature from "../components/Signature";
import { getRouteOptions } from "../services/routingService";
import {
  listenToReports,
  addReport,
  confirmReport,
  denyReport,
} from "../services/reportService";
import { listenToCameras, checkCameraAlerts } from "../services/cameraService";
import { speak } from "../services/voiceService";

export default function MapScreen() {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeMode, setRouteMode] = useState("combined"); // پیش‌فرض
  const [crashReports, setCrashReports] = useState([]);
  const [policeReports, setPoliceReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [pickMode, setPickMode] = useState(null); // "origin" | "destination" | null

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
        (loc) => {
          const speedKmh = (loc.coords.speed || 0) * 3.6;
          if (!origin) {
            setOrigin({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
          checkCameraAlerts(
            { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            speedKmh,
            cameras
          );
        }
      );
    })();

    const unsubCrash = listenToReports("crash", setCrashReports);
    const unsubPolice = listenToReports("police", setPoliceReports);
    const unsubCam = listenToCameras(setCameras);

    return () => {
      unsubCrash();
      unsubPolice();
      unsubCam();
    };
  }, [cameras]);

  useEffect(() => {
    if (origin && destination) {
      const activeReports = [...crashReports, ...policeReports];
      getRouteOptions(origin, destination, activeReports)
        .then((options) => {
          setRoute(options[routeMode]);
          speak("مسیر پیشنهادی آماده شد");
        })
        .catch((e) => console.log(e));
    }
  }, [origin, destination, routeMode]);

  const handleMapPress = (e) => {
    if (pickMode === "origin") {
      setOrigin(e.nativeEvent.coordinate);
      setPickMode(null);
    } else if (pickMode === "destination") {
      setDestination(e.nativeEvent.coordinate);
      setPickMode(null);
    }
  };

  const handleLongPressReport = (type) => (e) => {
    addReport(type, e.nativeEvent.coordinate);
  };

  return (
    <View style={styles.container}>
      <SearchBar label="مبدأ" onSelect={setOrigin} />
      <SearchBar label="مقصد" onSelect={setDestination} />

      <View style={styles.modeRow}>
        <TouchableOpacity onPress={() => setPickMode("origin")}>
          <Text style={styles.modeBtn}>📍 انتخاب مبدأ روی نقشه</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPickMode("destination")}>
          <Text style={styles.modeBtn}>🎯 انتخاب مقصد روی نقشه</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity onPress={() => setRouteMode("shortest")}>
          <Text style={[styles.modeBtn, routeMode === "shortest" && styles.active]}>
            کوتاه‌ترین
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRouteMode("quietest")}>
          <Text style={[styles.modeBtn, routeMode === "quietest" && styles.active]}>
            خلوت‌ترین
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRouteMode("combined")}>
          <Text style={[styles.modeBtn, routeMode === "combined" && styles.active]}>
            ترکیبی (پیش‌فرض)
          </Text>
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        onPress={handleMapPress}
        onLongPress={handleLongPressReport("crash")}
        initialRegion={{
          latitude: 35.6892,
          longitude: 51.389,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {origin && <Marker coordinate={origin} pinColor="green" title="مبدأ" />}
        {destination && <Marker coordinate={destination} pinColor="red" title="مقصد" />}

        {route && (
          <Polyline coordinates={route.points} strokeWidth={5} strokeColor="#1e90ff" />
        )}

        {cameras.map((c) => (
          <Marker key={c.id} coordinate={c.location} pinColor="orange" title="دوربین" />
        ))}

        {crashReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={r.location}
            pinColor="black"
            title="تصادف"
            onCalloutPress={() => confirmReport("crash", r.id, r.confirmCount)}
          />
        ))}

        {policeReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={r.location}
            pinColor="purple"
            title="پلیس"
            onCalloutPress={() => confirmReport("police", r.id, r.confirmCount)}
          />
        ))}
      </MapView>

      <View style={styles.reportRow}>
        <TouchableOpacity
          onPress={() => origin && addReport("crash", origin)}
        >
          <Text style={styles.modeBtn}>🚗 گزارش تصادف</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => origin && addReport("police", origin)}
        >
          <Text style={styles.modeBtn}>👮 گزارش پلیس</Text>
        </TouchableOpacity>
      </View>

      <Signature />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  modeRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 },
  reportRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6 },
  modeBtn: { padding: 6, fontSize: 12 },
  active: { fontWeight: "bold", color: "#1e90ff" },
});
