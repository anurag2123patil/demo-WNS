export const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@7.4.0/ol.css" />
  <script src="https://cdn.jsdelivr.net/npm/ol@7.4.0/dist/ol.js"></script>
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #f0f0f0;
    }
    #google-logo {
      position: absolute;
      bottom: 10px;
      left: 10px;
      height: 24px;
      z-index: 10;
      pointer-events: none;
    }
    .ol-scale-line {
      background: rgba(255, 255, 255, 0.7) !important;
      border-radius: 4px !important;
      bottom: 12px !important;
      left: 90px !important;
      position: absolute !important;
      padding: 2px 5px !important;
    }
    .ol-scale-line-inner {
      border: 1px solid #333 !important;
      border-top: none !important;
      color: #333 !important;
      font-weight: 600 !important;
      font-size: 11px !important;
      font-family: Arial, sans-serif !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <img id="google-logo" src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" alt="Google" />
  <script>
    let map;
    let osmLayer, satelliteLayer, hybridLayer;
    const wmsLayers = {};
    let locationLayer = null;
    let wfsHighlightLayer = null;

    // ── MAP TOKEN ─────────────────────────────────────────────────────────────
    // Stored here so every imageLoadFunction can read the latest value.
    // Updated from React Native via window.updateMapToken().
    let _currentMapToken = '';

 window.updateMapToken = function(newToken) {
    _currentMapToken = newToken;
    console.log('🔑 Map token updated:', newToken.substring(0, 10) + '...');

    // Refresh all existing WMS layers (forces new tile requests with new token)
    Object.values(wmsLayers).forEach(function(layer) {
      var source = layer.getSource();
      if (source && typeof source.updateParams === 'function') {
        source.updateParams({ _t: Date.now() });
      }
    });
  };

    // ── IMAGE LOAD FUNCTION ───────────────────────────────────────────────────
    // Used by every ImageWMS source. Fetches the WMS image with X-Map-Token header
    // so GeoServer authorises the request.
    function createSecureImageLoadFunction() {
      return function(image, src) {
        fetch(src, {
          headers: {
            'X-Map-Token': _currentMapToken
          }
        })
        .then(function(response) {
          if (!response.ok) throw new Error('WMS image fetch failed: ' + response.status);
          return response.blob();
        })
        .then(function(blob) {
          var objectUrl = URL.createObjectURL(blob);
          image.getImage().src = objectUrl;
        })
        .catch(function(err) {
          console.error('❌ WMS image load error:', err);
        });
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    function initMap() {
      osmLayer = new ol.layer.Tile({
        source: new ol.source.OSM(),
        visible: false
      });

     satelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=AIzaSyDoqCLK-jdExjAXlcGFh-yZpGQ2POhKrwA',
    maxZoom: 21,
    attributions: '© Google'
  }),
  visible: true
});
// satelliteLayer = new ol.layer.Tile({
//   source: new ol.source.XYZ({
//     url: 'https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=YOUR_GOOGLE_MAPS_API_KEY',  
//     maxZoom: 21,
//     attributions: '© Google'
//   }),
//   visible: true
// });    //AIzaSyBl-8vWUETJl3ucsRbXtz8Bz3Yhj3oGYII
     hybridLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=AIzaSyDoqCLK-jdExjAXlcGFh-yZpGQ2POhKrwA',
    maxZoom: 21,
    attributions: '© Google'
  }),
  visible: false
});

      map = new ol.Map({
        target: 'map',
        layers: [osmLayer, satelliteLayer, hybridLayer],
        view: new ol.View({
          center: ol.proj.fromLonLat([73.8567, 18.5204]),
          zoom: 12
        }),
        controls: [
          new ol.control.ScaleLine({
            units: 'metric',
            bar: false,
            minWidth: 64
          })
        ]
      });

      window.setMapBaseLayer = function(type) {
        osmLayer.setVisible(type === 'osm');
        satelliteLayer.setVisible(type === 'satellite');
        hybridLayer.setVisible(type === 'hybrid');
      };

      window.drawWatermark = function(base64Str, line1, line2) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();

        img.onload = function() {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          var barHeight = Math.floor(canvas.height * 0.16);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

          var padding = Math.floor(canvas.width * 0.05);

          var fontSizeCoords = Math.floor(canvas.width * 0.038);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold ' + fontSizeCoords + 'px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(line1, padding, canvas.height - (barHeight * 0.60));

          var fontSizeArea = Math.floor(canvas.width * 0.042);
          ctx.font = 'bold ' + fontSizeArea + 'px Arial';
          ctx.fillText(line2, padding, canvas.height - (barHeight * 0.22));

          window.ReactNativeWebView.postMessage('STAMPED_IMAGE:' + canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = base64Str;
      };

      var clickTimeout = null;
      map.on('singleclick', function(evt) {
        if (clickTimeout) clearTimeout(clickTimeout);
        clickTimeout = setTimeout(function() {
          var view = map.getView();
          var size = map.getSize();
          var extent = view.calculateExtent(size);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MAP_FEATURE_CLICK',
            payload: {
              coordinate: evt.coordinate,
              projection: view.getProjection().getCode(),
              resolution: view.getResolution(),
              bbox: extent,
              width: size[0],
              height: size[1]
            }
          }));
        }, 250);
      });

      window.highlightFeature = function(featureCollection) {
        if (!map) { console.error('❌ Map not initialized'); return; }

        var existing = map.getLayers().getArray().find(function(l) {
          return l.get('name') === 'feature-highlight';
        });
        if (existing) map.removeLayer(existing);

        var features = new ol.format.GeoJSON().readFeatures(featureCollection, {
          featureProjection: 'EPSG:3857'
        });
        if (!features || features.length === 0) { console.error('❌ No features parsed'); return; }

        var vectorSource = new ol.source.Vector({ features: features });

        var highlightStyle = function(feature) {
          var type = feature.getGeometry().getType();
          if (type === 'Point' || type === 'MultiPoint') {
            return [
              new ol.style.Style({
                image: new ol.style.Circle({ radius: 14, stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 3 }) }),
                zIndex: 1
              }),
              new ol.style.Style({
                image: new ol.style.Circle({
                  radius: 10,
                  fill: new ol.style.Fill({ color: 'rgba(0, 122, 255, 0.6)' }),
                  stroke: new ol.style.Stroke({ color: '#007AFF', width: 3 })
                }),
                zIndex: 2
              })
            ];
          }
          if (type.includes('LineString')) {
            return [
              new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 10 }), zIndex: 1 }),
              new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#007AFF', width: 5 }), zIndex: 2 })
            ];
          }
          if (type.includes('Polygon')) {
            return new ol.style.Style({
              stroke: new ol.style.Stroke({ color: '#007AFF', width: 4 }),
              fill: new ol.style.Fill({ color: 'rgba(0, 122, 255, 0.3)' })
            });
          }
          return new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#007AFF', width: 3 }),
            fill: new ol.style.Fill({ color: 'rgba(0, 122, 255, 0.2)' })
          });
        };

        var vectorLayer = new ol.layer.Vector({
          source: vectorSource,
          style: highlightStyle,
          zIndex: 9999
        });
        vectorLayer.set('name', 'feature-highlight');
        map.addLayer(vectorLayer);
      };

      console.log('✅ Map initialized');
        window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'MAP_INIT_COMPLETE'
  }));
    }

    function showMyLocation(lat, lon) {
      var coord = ol.proj.fromLonLat([lon, lat]);
      if (locationLayer) map.removeLayer(locationLayer);

      var feature = new ol.Feature({ geometry: new ol.geom.Point(coord) });
      feature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({ color: '#007AFF' }),
          stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 2 })
        })
      }));

      locationLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [feature] }),
        zIndex: 999
      });
      map.addLayer(locationLayer);
      map.getView().animate({ center: coord, zoom: 15, duration: 1000 });
    }

    window.renderWFSBBox = function(featureCollection) {
      if (!map) { console.error('❌ Map not ready'); return; }
      try {
        if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
          console.warn('⚠️ No features to render');
          return;
        }
        var vectorSource = new ol.source.Vector({
          features: new ol.format.GeoJSON().readFeatures(featureCollection, {
            featureProjection: 'EPSG:3857'
          })
        });
        var extent = vectorSource.getExtent();
        if (!ol.extent.isEmpty(extent)) {
          map.getView().fit(extent, { padding: [100, 100, 100, 100], maxZoom: 18, duration: 1000 });
        }
      } catch (e) {
        console.error('❌ BBox render error:', e);
      }
    };

    // ── ADD WMS ───────────────────────────────────────────────────────────────
    // Uses createSecureImageLoadFunction() so every image request carries
    // the latest X-Map-Token from _currentMapToken.
    function addWMS(data) {
      if (wmsLayers[data.layerId]) {
        map.removeLayer(wmsLayers[data.layerId]);
      }

      var layer = new ol.layer.Image({
        source: new ol.source.ImageWMS({
          url: data.url,
          params: { ...data.params },
          serverType: data.serverType || 'geoserver',
          ratio: 1,
         
        })
      });

      wmsLayers[data.layerId] = layer;
      map.addLayer(layer);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LAYER_ADDED',
        payload: { layerId: data.layerId, url: data.url, params: data.params }
      }));
    }
    // ─────────────────────────────────────────────────────────────────────────

    function removeWMS(layerId) {
      if (wmsLayers[layerId]) {
        map.removeLayer(wmsLayers[layerId]);
        delete wmsLayers[layerId];
      }
    }

    var projectExtent = null;

    window.zoomToExtent = function(minx, miny, maxx, maxy) {
      if (!map) return;
      projectExtent = [minx, miny, maxx, maxy];
      var extent = ol.proj.transformExtent(projectExtent, 'EPSG:4326', 'EPSG:3857');
      map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1500, maxZoom: 18 });
    };

    window.clearHighlight = function() {
      if (!map) return;
      var highlightLayer = map.getLayers().getArray().find(function(l) {
        return l.get('name') === 'feature-highlight';
      });
      if (highlightLayer) map.removeLayer(highlightLayer);
    };

    function handleRNMessage(event) {
      try {
        var msg = JSON.parse(event.data);
        var view = map.getView();

        if (msg.type === 'ZOOM_TO_EXTENT') {
          window.zoomToExtent(msg.payload.minx, msg.payload.miny, msg.payload.maxx, msg.payload.maxy);
        } else if (msg.type === 'ZOOM_IN') {
          view.setZoom(view.getZoom() + 1);
        } else if (msg.type === 'ZOOM_OUT') {
          view.setZoom(view.getZoom() - 1);
        } else if (msg.type === 'RESET_VIEW') {
          if (msg.payload && msg.payload.minx !== undefined) {
            var ext1 = [msg.payload.minx, msg.payload.miny, msg.payload.maxx, msg.payload.maxy];
            map.getView().fit(ol.proj.transformExtent(ext1, 'EPSG:4326', 'EPSG:3857'), { padding: [50, 50, 50, 50], duration: 1500, maxZoom: 18 });
          } else if (projectExtent) {
            map.getView().fit(ol.proj.transformExtent(projectExtent, 'EPSG:4326', 'EPSG:3857'), { padding: [50, 50, 50, 50], duration: 1500, maxZoom: 18 });
          }
        } else if (msg.type === 'UPDATE_MAP_TOKEN') {
          // ← React Native can also push token updates as a message
          window.updateMapToken(msg.payload);
        } else if (msg.type === 'SHOW_MY_LOCATION') {
          showMyLocation(msg.payload.lat, msg.payload.lon);
        } else if (msg.type === 'ADD_WMS_LAYER') {
          addWMS(msg.payload);
        } else if (msg.type === 'REMOVE_WMS_LAYER') {
          removeWMS(msg.payload.layerId);
        } else if (msg.type === 'RENDER_WFS_BBOX') {
          window.renderWFSBBox(msg.payload);
        } else if (msg.type === 'SET_BASE_LAYER') {
          window.setMapBaseLayer(msg.payload);
        } else if (msg.type === 'CLEAR_HIGHLIGHT') {
          window.clearHighlight();
        }
      } catch (e) {
        console.error('Message handler error:', e);
      }
    }

    window.addEventListener('message', handleRNMessage);
    document.addEventListener('message', handleRNMessage);

    initMap();
  </script>
</body>
</html>
`;