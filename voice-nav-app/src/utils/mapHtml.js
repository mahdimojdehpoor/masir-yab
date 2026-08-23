// این فایل یک صفحه‌ی HTML کامل با نقشه‌ی Leaflet می‌سازه که داخل WebView لود می‌شه
// ارتباط با React Native از طریق postMessage انجام می‌شه

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
    var map = L.map('map', { zoomControl: false }).setView([35.6892, 51.389], 13);

    var tileLayers = {
      street: L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri, Maxar',
        maxZoom: 19,
      }),
      topo: L.tileLayer('https://a.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenTopoMap (CC-BY-SA)',
        maxZoom: 17,
      }),
    };

    var currentLayer = tileLayers.street.addTo(map);

    function setTileLayer(mode) {
      map.removeLayer(currentLayer);
      currentLayer = tileLayers[mode] || tileLayers.street;
      currentLayer.addTo(map);
    }

    function flyTo(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 15, { animate: true });
    }

    function send(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    // لایه‌ی جداگانه برای هرکدوم تا بشه راحت پاک/بازسازی کرد
    var markersLayer = L.layerGroup().addTo(map);
    var routesLayer = L.layerGroup().addTo(map);
    var userMarker = null;

    function makeDot(color, size) {
      return L.divIcon({
        className: '',
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,0.4);"></div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    }

    function updateData(data) {
      markersLayer.clearLayers();
      routesLayer.clearLayers();

      if (data.myLocation) {
        var icon = makeDot('#1e90ff', 20);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([data.myLocation.latitude, data.myLocation.longitude], { icon: icon }).addTo(map);
      }

      if (data.origin) {
        L.marker([data.origin.latitude, data.origin.longitude], { icon: makeDot('#2e7d32', 18) }).addTo(markersLayer);
      }
      if (data.destination) {
        L.marker([data.destination.latitude, data.destination.longitude], { icon: makeDot('#e53935', 18) }).addTo(markersLayer);
      }
      (data.marks || []).forEach(function (m) {
        L.marker([m.latitude, m.longitude], { icon: makeDot('#f9a825', 18) }).addTo(markersLayer);
      });
      (data.cameras || []).forEach(function (c) {
        L.marker([c.location.latitude, c.location.longitude], { icon: makeDot('#fb8c00', 18) }).addTo(markersLayer);
      });
      (data.crashReports || []).forEach(function (r) {
        var mk = L.marker([r.location.latitude, r.location.longitude], { icon: makeDot('#000000', 18) }).addTo(markersLayer);
        mk.on('click', function () { send({ type: 'marker', kind: 'crash', id: r.id }); });
      });
      (data.policeReports || []).forEach(function (r) {
        var mk = L.marker([r.location.latitude, r.location.longitude], { icon: makeDot('#8e24aa', 18) }).addTo(markersLayer);
        mk.on('click', function () { send({ type: 'marker', kind: 'police', id: r.id }); });
      });
      (data.poiResults || []).forEach(function (p) {
        var mk = L.marker([p.location.latitude, p.location.longitude], { icon: makeDot('#00897b', 18) }).addTo(markersLayer);
        mk.on('click', function () { send({ type: 'marker', kind: 'poi', id: p.id }); });
      });
      (data.routeSegments || []).forEach(function (seg) {
        var latlngs = seg.points.map(function (p) { return [p.latitude, p.longitude]; });
        L.polyline(latlngs, { color: seg.color, weight: 5 }).addTo(routesLayer);
      });
    }

    // تشخیص لمس طولانی (long press) روی نقشه
    var pressTimer = null;
    var pressStart = null;
    var moved = false;

    function startPress(latlng) {
      moved = false;
      pressStart = latlng;
      pressTimer = setTimeout(function () {
        if (!moved && pressStart) {
          send({ type: 'longpress', lat: pressStart.lat, lng: pressStart.lng });
        }
      }, 600);
    }

    function cancelPress() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
    }

    map.on('mousedown', function (e) { startPress(e.latlng); });
    map.on('touchstart', function (e) {
      if (e.latlng) startPress(e.latlng);
    });
    map.on('mousemove', function () { moved = true; });
    map.on('drag', function () { moved = true; });
    map.on('mouseup', cancelPress);
    map.on('touchend', cancelPress);
    map.on('touchcancel', cancelPress);

    send({ type: 'ready' });
  </script>
</body>
</html>
`;
}
