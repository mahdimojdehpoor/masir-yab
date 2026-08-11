// این فایل HTML نقشه‌ی Leaflet رو می‌سازه که داخل WebView لود میشه
// از OpenStreetMap استفاده می‌کنه: کاملاً رایگان، بدون نیاز به کلید یا کارت بانکی

export function getMapHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([35.6892, 51.389], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var originMarker = null;
  var destinationMarker = null;
  var routeLine = null;
  var cameraMarkers = [];
  var crashMarkers = [];
  var policeMarkers = [];

  function sendToRN(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  // ---- تشخیص لمس ساده و لمس‌طولانی ----
  var pressTimer = null;
  var pressLatLng = null;
  var moved = false;

  function startPress(latlng) {
    pressLatLng = latlng;
    moved = false;
    pressTimer = setTimeout(function () {
      if (pressLatLng && !moved) {
        sendToRN({
          type: 'longPress',
          coordinate: { latitude: pressLatLng.lat, longitude: pressLatLng.lng }
        });
        pressLatLng = null;
      }
    }, 600);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
  }

  map.on('mousedown touchstart', function (e) {
    startPress(e.latlng);
  });
  map.on('mousemove touchmove drag', function () {
    moved = true;
    cancelPress();
  });
  map.on('mouseup touchend', function (e) {
    cancelPress();
    if (pressLatLng && !moved) {
      sendToRN({
        type: 'mapPress',
        coordinate: { latitude: pressLatLng.lat, longitude: pressLatLng.lng }
      });
    }
    pressLatLng = null;
  });

  // ---- به‌روزرسانی داده‌ها روی نقشه ----
  function updateData(data) {
    if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
    if (data.origin) {
      originMarker = L.circleMarker([data.origin.latitude, data.origin.longitude], {
        radius: 8, color: '#0a8f2a', fillColor: '#2ecc71', fillOpacity: 0.95, weight: 2
      }).addTo(map).bindPopup('مبدأ');
    }

    if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; }
    if (data.destination) {
      destinationMarker = L.circleMarker([data.destination.latitude, data.destination.longitude], {
        radius: 8, color: '#a30000', fillColor: '#e74c3c', fillOpacity: 0.95, weight: 2
      }).addTo(map).bindPopup('مقصد');
    }

    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (data.route && data.route.length > 0) {
      var latlngs = data.route.map(function (p) { return [p.latitude, p.longitude]; });
      routeLine = L.polyline(latlngs, { color: '#1e90ff', weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
    }

    cameraMarkers.forEach(function (m) { map.removeLayer(m); });
    cameraMarkers = (data.cameras || []).map(function (c) {
      return L.circleMarker([c.location.latitude, c.location.longitude], {
        radius: 7, color: '#b8860b', fillColor: '#f39c12', fillOpacity: 0.95, weight: 2
      }).addTo(map).bindPopup('دوربین سرعت' + (c.speedLimit ? (' - سرعت مجاز: ' + c.speedLimit) : ''));
    });

    crashMarkers.forEach(function (m) { map.removeLayer(m); });
    crashMarkers = (data.crashReports || []).map(function (r) {
      var m = L.circleMarker([r.location.latitude, r.location.longitude], {
        radius: 7, color: '#000', fillColor: '#333', fillOpacity: 0.95, weight: 2
      }).addTo(map).bindPopup('تصادف - برای تایید لمس کنید');
      m.on('click', function () {
        sendToRN({ type: 'confirmReport', reportType: 'crash', id: r.id, confirmCount: r.confirmCount });
      });
      return m;
    });

    policeMarkers.forEach(function (m) { map.removeLayer(m); });
    policeMarkers = (data.policeReports || []).map(function (r) {
      var m = L.circleMarker([r.location.latitude, r.location.longitude], {
        radius: 7, color: '#5b1a8b', fillColor: '#8e44ad', fillOpacity: 0.95, weight: 2
      }).addTo(map).bindPopup('پلیس - برای تایید لمس کنید');
      m.on('click', function () {
        sendToRN({ type: 'confirmReport', reportType: 'police', id: r.id, confirmCount: r.confirmCount });
      });
      return m;
    });
  }

  // پیام‌های اومده از برنامه‌ی React Native
  function handleMessage(event) {
    try {
      var data = JSON.parse(event.data);
      updateData(data);
    } catch (e) {}
  }
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);

  map.whenReady(function () {
    sendToRN({ type: 'ready' });
  });
</script>
</body>
</html>
`;
}
