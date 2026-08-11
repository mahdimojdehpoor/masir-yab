import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";

import SearchBar from "../components/SearchBar";
import Signature from "../components/Signature";
import { getRouteOptions } from "../services/routingService";
import {
  listenToReports,
  addReport,
  confirmReport,
} from "../services/reportService";
import { listenToCameras, checkCameraAlerts } from "../services/cameraService";
import { speak } from "../services/voiceService";
import { getMapHtml } from "../utils/mapHtml";

export default function MapScreen() {
  const webviewRef = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeMode, setRouteMode] = useState("combined"); // پیش‌فرض
  const [crashReports, setCrashReports] = useState([]);
  const [policeReports, setPoliceReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [pickMode, setPickMode] = useState(null); // "origin" | "destination" | null
  const [mapReady, setMapReady] = useState(false);

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

  // هر بار داده‌ها عوض شدن، به نقشه‌ی داخل WebView بفرست
  useEffect(() => {
    if (!mapReady || !webviewRef.current) return;
    const payload = {
      origin,
      destination,
      route: route ? route.points : null,
      cameras,
      crashReports,
      policeReports,
    };
    webviewRef.current.postMessage(JSON.stringify(payload));
  }, [origin, destination, route, cameras, crashReports, policeReports, mapReady]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ready") {
        setMapReady(true);
      } else if (data.type === "mapPress") {
        if (pickMode === "origin") {
          setOrigin(data.coordinate);
          setPickMode(null);
        } else if (pickMode === "destination") {
          setDestination(data.coordinate);
          setPickMode(null);
        }
      } else if (data.type === "longPress") {
        addReport("crash", data.coordinate);
      } else if (data.type === "confirmReport") {
        confirmReport(data.reportType, data.id, data.confirmCount);
      }
    } catch (e) {
      console.log("خطا در پردازش پیام نقشه:", e);
    }
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

      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: getMapHtml() }}
        onMessage={handleWebViewMessage}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      <View style={styles.reportRow}>
        <TouchableOpacity onPress={() => origin && addReport("crash", origin)}>
          <Text style={styles.modeBtn}>🚗 گزارش تصادف</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => origin && addReport("police", origin)}>
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
