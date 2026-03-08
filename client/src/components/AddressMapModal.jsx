import React, { useState, useEffect } from 'react';
import styles from './AddressMapModal.module.css';

function buildGoogleSearchUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildGoogleDirectionsUrl(origin, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
}

const MAP_STYLES = {
  map: 'mapbox/streets-v12',
  sat: 'mapbox/satellite-v9'
};

const ZOOM_MIN = 10;
const ZOOM_MAX = 18;
const MAP_W = 780;
const MAP_H = 480;
const PAN_CLAMP_X = 200;
const PAN_CLAMP_Y = 120;

// Convert pixel drag at given zoom to degrees (Mapbox: 512px = 360° at zoom 0, scale 2^z)
function pixelsToDegrees(pixels, zoom) {
  return (360 / (512 * Math.pow(2, zoom)));
}

export default function AddressMapModal({ address, companyAddress = '', mapboxToken = '', onClose }) {
  const [coords, setCoords] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mapStyle, setMapStyle] = useState('map');
  const [zoom, setZoom] = useState(14);
  const [viewCenter, setViewCenter] = useState(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [displayMapUrl, setDisplayMapUrl] = useState(null);
  const panOffsetRef = React.useRef({ x: 0, y: 0 });
  const mapWrapRef = React.useRef(null);
  const mapImageWrapRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const justDraggedRef = React.useRef(false);
  const mapInteractionRef = React.useRef(false);
  const viewCenterRef = React.useRef(null);
  const kRef = React.useRef(0);
  const isDraggingRef = React.useRef(false);
  const pendingDisplayMapUrlRef = React.useRef(null);

  useEffect(() => {
    if (!address?.trim() || !mapboxToken?.trim()) {
      setCoords(null);
      setViewCenter(null);
      setDisplayMapUrl(null);
      setMapError(null);
      setMapLoading(false);
      setImageError(false);
      pendingDisplayMapUrlRef.current = null;
      return;
    }
    setMapError(null);
    setMapLoading(true);
    setImageError(false);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${encodeURIComponent(mapboxToken.trim())}&limit=1`;
    fetch(url)
      .then(r => {
        return r.json().then(data => {
          if (!r.ok) {
            const msg = data.message || (typeof data.error === 'string' ? data.error : null) || 'Could not load map';
            throw new Error(msg);
          }
          return data;
        });
      })
      .then(data => {
        const feature = data.features?.[0];
        if (feature?.center?.length >= 2) {
          const c = { lng: feature.center[0], lat: feature.center[1] };
          setCoords(c);
          setViewCenter(c);
        } else {
          setMapError('Address not found');
        }
      })
      .catch(err => setMapError(err.message || 'Could not load map'))
      .finally(() => setMapLoading(false));
  }, [address, mapboxToken]);

  const zoomClamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  const k = pixelsToDegrees(1, zoomClamped);
  viewCenterRef.current = viewCenter;
  kRef.current = k;

  const handleMapMouseDown = (e) => {
    if (e.button !== 0) return;
    const center = viewCenterRef.current;
    if (!center) return;
    if (e.target.closest('[data-map-overlay]')) return;
    e.preventDefault();
    mapInteractionRef.current = true;
    isDraggingRef.current = true;
    document.body.style.cursor = 'grabbing';
    const wrap = mapImageWrapRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLng = center.lng;
    const startLat = center.lat;
    panOffsetRef.current = { x: 0, y: 0 };
    const onMove = (e) => {
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;
      dx = Math.max(-PAN_CLAMP_X, Math.min(PAN_CLAMP_X, dx));
      dy = Math.max(-PAN_CLAMP_Y, Math.min(PAN_CLAMP_Y, dy));
      panOffsetRef.current = { x: dx, y: dy };
      if (wrap) wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp, true);
      document.body.style.cursor = '';
      justDraggedRef.current = true;
      const off = panOffsetRef.current;
      setPanOffset({ x: 0, y: 0 });
      const kVal = kRef.current;
      const newLng = startLng - off.x * kVal;
      let newLat = startLat + off.y * kVal;
      newLat = Math.min(85, Math.max(-85, newLat));
      setViewCenter({ lng: newLng, lat: newLat });
      const pending = pendingDisplayMapUrlRef.current;
      if (pending) {
        pendingDisplayMapUrlRef.current = null;
        setDisplayMapUrl(pending);
        if (wrap) wrap.style.transform = 'translate3d(0, 0, 0)';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, true);
  };

  const handleMapWheel = React.useCallback((e) => {
    if (!viewCenter) return;
    e.preventDefault();
    setZoom(z => {
      const next = e.deltaY > 0 ? z - 1 : z + 1;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    });
  }, [viewCenter]);

  React.useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleMapWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleMapWheel);
  }, [handleMapWheel]);

  const styleId = MAP_STYLES[mapStyle] || MAP_STYLES.map;
  const center = viewCenter || coords;
  const MAP_W = 780;
  const MAP_H = 480;
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const token = mapboxToken?.trim() || '';
  const staticMapUrl = coords && token && center
    ? `https://api.mapbox.com/styles/v1/${styleId}/static/pin-l+1a8fc1(${round6(coords.lng)},${round6(coords.lat)})/${round6(center.lng)},${round6(center.lat)},${zoomClamped},0/${MAP_W}x${MAP_H}?access_token=${encodeURIComponent(token)}`
    : null;

  // Only ever set displayMapUrl when a tile has finished loading (preload onLoad), so we never show blank/loading tiles
  React.useEffect(() => {
    if (!staticMapUrl) {
      setDisplayMapUrl(null);
      return;
    }
    setImageError(false);
  }, [staticMapUrl]);

  React.useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.target !== el) return;
      if (mapInteractionRef.current) {
        mapInteractionRef.current = false;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      onClose();
    };
    el.addEventListener('click', handler, true);
    return () => el.removeEventListener('click', handler, true);
  }, [onClose]);

  const handleMapClick = (e) => {
    e.stopPropagation();
    if (justDraggedRef.current) {
      e.preventDefault();
      justDraggedRef.current = false;
    }
  };

  const handleMapPointer = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Address map"
    >
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{address || 'Address'}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.body}>
          {!mapboxToken?.trim() && (
            <p className={styles.mapHint}>Add a Mapbox access token in Settings → Mapbox to show a map here.</p>
          )}
          {mapboxToken?.trim() && mapLoading && (
            <p className={styles.mapHint}>Loading map…</p>
          )}
          {staticMapUrl && !mapError && !mapLoading && (
            <div className={styles.mapSection}>
              <div
                ref={mapWrapRef}
                className={`${styles.mapWrap} ${styles.mapWrapGrab}`}
                onMouseDown={(e) => { handleMapPointer(e); handleMapMouseDown(e); }}
                onMouseUp={handleMapPointer}
                onClick={handleMapClick}
                role="application"
                aria-label="Map (drag to pan, scroll to zoom)"
              >
                <div className={styles.mapStyleOverlay} data-map-overlay role="group" aria-label="Map style" onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`${styles.mapStyleBtn} ${mapStyle === 'map' ? styles.mapStyleBtnActive : ''}`}
                    onClick={() => { setMapStyle('map'); setImageError(false); }}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    className={`${styles.mapStyleBtn} ${mapStyle === 'sat' ? styles.mapStyleBtnActive : ''}`}
                    onClick={() => { setMapStyle('sat'); setImageError(false); }}
                  >
                    Satellite
                  </button>
                </div>
                <div
                  ref={mapImageWrapRef}
                  className={styles.mapImageWrap}
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`
                  }}
                >
                  {displayMapUrl ? (
                    <img
                      src={displayMapUrl}
                      alt={mapStyle === 'sat' ? 'Satellite map' : 'Street map'}
                      className={styles.staticMap}
                      onLoad={() => setImageError(false)}
                      onError={() => setImageError(true)}
                      draggable={false}
                    />
                  ) : staticMapUrl ? (
                    <div className={styles.mapLoadingTile} aria-hidden="true">
                      Loading map…
                    </div>
                  ) : null}
                  {staticMapUrl && staticMapUrl !== displayMapUrl && (
                    <img
                      src={staticMapUrl}
                      alt=""
                      aria-hidden="true"
                      className={styles.mapPreloadImg}
                      onLoad={() => {
                        if (isDraggingRef.current) {
                          pendingDisplayMapUrlRef.current = staticMapUrl;
                        } else {
                          setDisplayMapUrl(staticMapUrl);
                          if (mapImageWrapRef.current) mapImageWrapRef.current.style.transform = 'translate3d(0, 0, 0)';
                        }
                      }}
                      onError={() => setImageError(true)}
                    />
                  )}
                </div>
                <div className={styles.mapLinksOverlay} data-map-overlay onMouseDown={e => e.stopPropagation()}>
                  <a
                    href={address ? buildGoogleSearchUrl(address) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapLinkBtn}
                  >
                    Open in Google Maps
                  </a>
                  {companyAddress?.trim() && address?.trim() && (
                    <a
                      href={buildGoogleDirectionsUrl(companyAddress.trim(), address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.mapLinkBtnSecondary}
                    >
                      Directions from company
                    </a>
                  )}
                </div>
                <div className={styles.zoomOverlay} data-map-overlay role="group" aria-label="Zoom" onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.zoomBtn}
                    onClick={e => { e.stopPropagation(); setZoom(z => Math.max(ZOOM_MIN, z - 1)); }}
                    disabled={zoom <= ZOOM_MIN}
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.zoomBtn}
                    onClick={e => { e.stopPropagation(); setZoom(z => Math.min(ZOOM_MAX, z + 1)); }}
                    disabled={zoom >= ZOOM_MAX}
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
                {imageError && <p className={styles.mapErrorOverlay}>Map image could not be loaded.</p>}
              </div>
            </div>
          )}
          {mapError && mapboxToken?.trim() && !mapLoading && (
            <p className={styles.mapError}>{mapError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
