import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api, isAbortError } from '../api.js';
import styles from './MapsPage.module.css';

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Signed',
  confirmed: 'Confirmed',
  closed: 'Closed',
};

const PIN_GROUPS = {
  quote: { label: 'Quotes', cssVar: '--color-primary', fallback: '#2563eb' },
  booked: { label: 'Booked', cssVar: '--color-success', fallback: '#16a34a' },
  closed: { label: 'Closed', cssVar: '--color-text-muted', fallback: '#64748b' },
};

function getMapStyleUrl(mapDefaultStyle) {
  if (mapDefaultStyle === 'sat' || mapDefaultStyle === 'satellite') {
    return 'mapbox://styles/mapbox/satellite-v9';
  }
  return 'mapbox://styles/mapbox/streets-v12';
}

function formatEventDate(value) {
  if (!value) return 'No event date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function readThemeMapColors() {
  if (typeof window === 'undefined') {
    return {
      quote: PIN_GROUPS.quote.fallback,
      booked: PIN_GROUPS.booked.fallback,
      closed: PIN_GROUPS.closed.fallback,
      cluster: '#111827',
    };
  }
  const root = getComputedStyle(document.documentElement);
  const read = (cssVar, fallback) => String(root.getPropertyValue(cssVar) || '').trim() || fallback;
  return {
    quote: read(PIN_GROUPS.quote.cssVar, PIN_GROUPS.quote.fallback),
    booked: read(PIN_GROUPS.booked.cssVar, PIN_GROUPS.booked.fallback),
    closed: read(PIN_GROUPS.closed.cssVar, PIN_GROUPS.closed.fallback),
    cluster: read('--color-text', '#111827'),
  };
}

function buildGeoJson(pins) {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(pin.lng), Number(pin.lat)],
      },
      properties: {
        quote_id: Number(pin.quote_id),
        quote_name: pin.quote_name || '',
        status: pin.status || 'draft',
        pin_type: pin.pin_type || 'quote',
        event_date: pin.event_date || '',
        client_name: pin.client_name || '',
        venue_name: pin.venue_name || '',
        address: pin.address || '',
      },
    })),
  };
}

function ensureMapLayers(map, colors) {
  if (!map.getSource('quote-pins')) {
    map.addSource('quote-pins', {
      type: 'geojson',
      data: buildGeoJson([]),
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 12,
    });
  }

  if (!map.getLayer('clusters')) {
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'quote-pins',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': colors.cluster,
        'circle-opacity': 0.82,
        'circle-radius': ['step', ['get', 'point_count'], 18, 8, 22, 30, 28],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer('cluster-count')) {
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'quote-pins',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer('unclustered-points')) {
    map.addLayer({
      id: 'unclustered-points',
      type: 'circle',
      source: 'quote-pins',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'pin_type'],
          'booked', colors.booked,
          'closed', colors.closed,
          colors.quote,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }
}

function updateMapColors(map, colors) {
  if (map.getLayer('clusters')) {
    map.setPaintProperty('clusters', 'circle-color', colors.cluster);
  }
  if (map.getLayer('unclustered-points')) {
    map.setPaintProperty('unclustered-points', 'circle-color', [
      'match',
      ['get', 'pin_type'],
      'booked', colors.booked,
      'closed', colors.closed,
      colors.quote,
    ]);
  }
}

function createPopupContent(pin, navigate) {
  const wrap = document.createElement('div');
  wrap.className = styles.popupCard;

  const title = document.createElement('p');
  title.className = styles.popupTitle;
  title.textContent = pin.quote_name || 'Untitled project';
  wrap.appendChild(title);

  const meta = document.createElement('p');
  meta.className = styles.popupMeta;
  meta.textContent = `${STATUS_LABEL[pin.status] || pin.status} · ${formatEventDate(pin.event_date)}`;
  wrap.appendChild(meta);

  const line = document.createElement('p');
  line.className = styles.popupMeta;
  line.textContent = pin.venue_name || pin.client_name || pin.address || '';
  wrap.appendChild(line);

  if (pin.address) {
    const address = document.createElement('p');
    address.className = styles.popupMeta;
    address.textContent = pin.address;
    wrap.appendChild(address);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = styles.popupButton;
  button.textContent = 'Open project';
  button.addEventListener('click', () => navigate(`/quotes/${pin.quote_id}`));
  wrap.appendChild(button);

  return wrap;
}

export default function MapsPage() {
  const navigate = useNavigate();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxLibRef = useRef(null);
  const popupRef = useRef(null);
  const hasFitBoundsRef = useRef(false);

  const [mapConfig, setMapConfig] = useState({ mapboxToken: '', mapDefaultStyle: 'map' });
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [visibleGroups, setVisibleGroups] = useState({
    quote: true,
    booked: true,
    closed: true,
  });
  const [themeColors, setThemeColors] = useState(readThemeMapColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeColors(readThemeMapColors());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getMapQuotePins({ signal: controller.signal, dedupeKey: 'maps:quote-pins', cancelPrevious: true });
        if (cancelled) return;
        setMapConfig({
          mapboxToken: String(data.mapbox_token || ''),
          mapDefaultStyle: String(data.map_default_style || 'map'),
        });
        if (!String(data.mapbox_token || '').trim()) {
          setPins([]);
          setLoading(false);
          return;
        }
        setPins(Array.isArray(data.pins) ? data.pins : []);
      } catch (err) {
        if (!cancelled && !isAbortError(err)) {
          setError(err.message || 'Failed to load map data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const counts = useMemo(() => {
    return pins.reduce((acc, pin) => {
      const key = pin.pin_type || 'quote';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { quote: 0, booked: 0, closed: 0 });
  }, [pins]);

  const filteredPins = useMemo(
    () => pins.filter((pin) => visibleGroups[pin.pin_type || 'quote']),
    [pins, visibleGroups]
  );

  useEffect(() => {
    const token = String(mapConfig.mapboxToken || '').trim();
    if (!token || !mapNodeRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let map = null;

    (async () => {
      const module = await import('mapbox-gl');
      if (cancelled) return;
      const mapboxgl = module.default;
      mapboxLibRef.current = mapboxgl;
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: mapNodeRef.current,
        style: getMapStyleUrl(mapConfig.mapDefaultStyle),
        center: [-96, 32],
        zoom: 1.2,
        projection: 'mercator',
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');

      const handleLoad = () => {
        ensureMapLayers(map, themeColors);
        setMapLoaded(true);
      };

      const handleClusterClick = (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        map.getSource('quote-pins').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
      };

      const handlePointClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        setSelectedPin({
          quote_id: Number(feature.properties.quote_id),
          quote_name: feature.properties.quote_name,
          status: feature.properties.status,
          pin_type: feature.properties.pin_type,
          event_date: feature.properties.event_date,
          client_name: feature.properties.client_name,
          venue_name: feature.properties.venue_name,
          address: feature.properties.address,
          lng: Number(feature.geometry.coordinates[0]),
          lat: Number(feature.geometry.coordinates[1]),
        });
      };

      const handleMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
      const handleMouseLeave = () => { map.getCanvas().style.cursor = ''; };

      map.on('load', handleLoad);
      map.on('click', 'clusters', handleClusterClick);
      map.on('click', 'unclustered-points', handlePointClick);
      map.on('mouseenter', 'clusters', handleMouseEnter);
      map.on('mouseleave', 'clusters', handleMouseLeave);
      map.on('mouseenter', 'unclustered-points', handleMouseEnter);
      map.on('mouseleave', 'unclustered-points', handleMouseLeave);
      mapRef.current = map;
    })().catch((error) => {
      if (!cancelled) {
        console.error('[MapsPage] Failed to load Mapbox:', error);
        setError(error?.message || 'Failed to load map');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      popupRef.current = null;
      if (map) map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [mapConfig.mapDefaultStyle, mapConfig.mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    ensureMapLayers(map, themeColors);
    updateMapColors(map, themeColors);
    const source = map.getSource('quote-pins');
    if (source) {
      source.setData(buildGeoJson(filteredPins));
    }
  }, [filteredPins, mapLoaded, themeColors]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxLibRef.current;
    if (!mapLoaded || !map || !mapboxgl) return;
    if (filteredPins.length === 0) {
      if (!hasFitBoundsRef.current) {
        map.easeTo({ center: [-96, 32], zoom: 1.2 });
        hasFitBoundsRef.current = true;
      }
      return;
    }
    if (hasFitBoundsRef.current) return;
    const bounds = new mapboxgl.LngLatBounds();
    filteredPins.forEach((pin) => bounds.extend([Number(pin.lng), Number(pin.lat)]));
    map.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 900 });
    hasFitBoundsRef.current = true;
  }, [filteredPins, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxLibRef.current;
    if (!mapLoaded || !map || !mapboxgl) return;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!selectedPin) return;
    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 16 })
      .setLngLat([Number(selectedPin.lng), Number(selectedPin.lat)])
      .setDOMContent(createPopupContent(selectedPin, navigate))
      .addTo(map);
    popup.on('close', () => setSelectedPin(null));
    popupRef.current = popup;
    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, [mapLoaded, navigate, selectedPin]);

  useEffect(() => {
    if (!selectedPin) return;
    const stillVisible = filteredPins.some((pin) => Number(pin.quote_id) === Number(selectedPin.quote_id));
    if (!stillVisible) setSelectedPin(null);
  }, [filteredPins, selectedPin]);

  function toggleGroup(group) {
    setVisibleGroups((current) => ({ ...current, [group]: !current[group] }));
    hasFitBoundsRef.current = false;
  }

  const tokenMissing = !String(mapConfig.mapboxToken || '').trim();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maps</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            World view of quote, booked, and closed project locations.
          </p>
        </div>
        <div className={styles.meta}>
          <span className={styles.pill}>{pins.length} mapped projects</span>
          <span className={styles.pill}>Venue address first</span>
        </div>
      </div>

      <div className={styles.mapShell}>
        <div ref={mapNodeRef} className={styles.map} />

        <div className={styles.overlayTop}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>Map legend</p>
            <div className={styles.legend}>
              {Object.entries(PIN_GROUPS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.toggle} ${visibleGroups[key] ? styles.toggleActive : ''}`}
                  onClick={() => toggleGroup(key)}
                >
                  <span
                    className={styles.dot}
                    style={{ background: themeColors[key] }}
                    aria-hidden="true"
                  />
                  {meta.label} ({counts[key] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>How it works</p>
            <p className={styles.cardText}>
              Pins use the venue address when present, otherwise the client address. Click a pin to open a project link.
            </p>
          </div>
        </div>

        {loading && <div className={styles.skeleton} aria-hidden="true" />}

        {!loading && tokenMissing && (
          <div className={styles.mapEmpty}>
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>Mapbox token required</h2>
              <p className={styles.emptyText}>
                Add a Mapbox access token in Settings to enable the maps page and address geocoding.
              </p>
              <div className={styles.emptyActions}>
                <Link to="/settings" className="btn btn-primary">Open Settings</Link>
              </div>
            </div>
          </div>
        )}

        {!loading && !tokenMissing && !error && filteredPins.length === 0 && (
          <div className={styles.mapEmpty}>
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>No mapped projects yet</h2>
              <p className={styles.emptyText}>
                No quotes with geocoded venue or client addresses matched the current map filters.
              </p>
            </div>
          </div>
        )}

        {!loading && !!error && (
          <div className={styles.mapEmpty}>
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>Map failed to load</h2>
              <p className={styles.emptyText}>{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
