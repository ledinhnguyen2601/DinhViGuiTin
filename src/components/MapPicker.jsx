import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { Crosshair, BookmarkPlus, Check, X, Loader2, Navigation } from 'lucide-react';
import { LocationService } from '../services/location.js';
import { reverseGeocode } from '../services/geo.js';
import { SmartInput } from './SmartInput.jsx';

// Default blue marker
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom colored icon for saved bookmarks
const SavedBookmarkIcon = L.divIcon({
  html: `<div style="background-color: #0284c7; color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.4); border: 2px solid white;">★</div>`,
  className: 'custom-saved-pin',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapEventsHandler({ onMapClick, onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

export function MapPicker({
  initialLat,
  initialLng,
  initialName = '',
  savedDestinations = [],
  onSelect,
  onSaveBookmarkAndSelect,
  onClose,
}) {
  const [position, setPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [destName, setDestName] = useState(initialName || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const mapRef = useRef(null);

  // Center coordinates logic:
  // 1. Initial coordinates passed in
  // 2. Last known user GPS location
  // 3. Fallback Hanoi
  const lastKnown = LocationService.getLastKnownPosition();
  const defaultCenter = position ||
    (lastKnown && lastKnown.lat ? { lat: lastKnown.lat, lng: lastKnown.lng } : { lat: 21.0285, lng: 105.8542 });

  // When clicking on map, set marker and reverse geocode
  const handleMapClick = async (latlng) => {
    const lat = Number(latlng.lat.toFixed(6));
    const lng = Number(latlng.lng.toFixed(6));
    setPosition({ lat, lng });
    setIsGeocoding(true);
    try {
      const place = await reverseGeocode(lat, lng);
      if (place) {
        setDestName(place);
      }
    } catch {}
    setIsGeocoding(false);
  };

  // Fly to user current location
  const handleLocateMe = async () => {
    setIsLocatingUser(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      const lat = Number(pos.lat.toFixed(6));
      const lng = Number(pos.lng.toFixed(6));
      setPosition({ lat, lng });
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1 });
      }
      setIsGeocoding(true);
      const place = await reverseGeocode(lat, lng);
      if (place) {
        setDestName(place);
      }
      setIsGeocoding(false);
    } catch (e) {
      console.warn('Could not locate user:', e);
    } finally {
      setIsLocatingUser(false);
    }
  };

  const handleConfirmSelectOnly = () => {
    if (!position) return;
    onSelect(position.lat, position.lng, destName.trim() || 'Điểm đã chọn');
  };

  const handleConfirmSaveAndSelect = () => {
    if (!position) return;
    const finalName = destName.trim() || 'Điểm yêu thích';
    if (typeof onSaveBookmarkAndSelect === 'function') {
      onSaveBookmarkAndSelect(finalName, position.lat, position.lng);
    } else {
      onSelect(position.lat, position.lng, finalName);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-fade-in select-none">
      {/* Top Header */}
      <div className="p-3.5 border-b flex items-center justify-between bg-white shadow-sm z-10">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base">Chấm ghim chọn điểm đến</h3>
          <p className="text-[11px] text-slate-500">Chạm trên bản đồ hoặc ghim nơi bạn đang đứng</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          center={defaultCenter}
          zoom={position ? 15 : 13}
          style={{ height: '100%', width: '100%' }}
        >
          <MapEventsHandler
            onMapClick={handleMapClick}
            onMapReady={(map) => {
              mapRef.current = map;
            }}
          />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Bản đồ đường phố">
              <TileLayer
                attribution='&copy; Google Maps'
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Bản đồ Vệ tinh">
              <TileLayer
                attribution='&copy; Google Maps'
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Render already saved bookmarks on the map */}
          {savedDestinations.map((saved) => (
            <Marker
              key={saved.id || `${saved.lat}_${saved.lng}`}
              position={[saved.lat, saved.lng]}
              icon={SavedBookmarkIcon}
              eventHandlers={{
                click: () => {
                  setPosition({ lat: saved.lat, lng: saved.lng });
                  setDestName(saved.name);
                },
              }}
            >
              <Popup>
                <div className="text-xs">
                  <span className="font-bold text-brand-600">⭐ {saved.name}</span>
                  <div className="text-[10px] text-slate-500">{saved.address || ''}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Current selected pin */}
          {position && <Marker position={position} />}
        </MapContainer>

        {/* Floating Quick Locate Me Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocatingUser}
          className="absolute right-4 bottom-56 z-[400] w-12 h-12 bg-white text-slate-800 rounded-full shadow-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition cursor-pointer"
          title="Vị trí của tôi"
        >
          {isLocatingUser ? (
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5 text-brand-600" />
          )}
        </button>

        {/* Bottom Control Sheet */}
        <div className="absolute bottom-0 left-0 right-0 z-[400] bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-2xl rounded-t-3xl space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <span>Tên điểm đến (tùy ý đặt):</span>
                {isGeocoding && <Loader2 className="w-3 h-3 text-brand-500 animate-spin" />}
              </label>
              {position && (
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </span>
              )}
            </div>
            <SmartInput
              value={destName}
              onChange={setDestName}
              placeholder="VD: Nhà, Quê ngoại, Cơ quan, Điểm gửi xe..."
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold text-slate-900 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleConfirmSaveAndSelect}
              disabled={!position}
              className="py-3 px-3 bg-gradient-to-r from-brand-600 to-sky-600 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition flex items-center justify-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Lưu & Chọn điểm</span>
            </button>

            <button
              onClick={handleConfirmSelectOnly}
              disabled={!position}
              className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs active:scale-95 transition flex items-center justify-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Chỉ chọn điểm này</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
