import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export function MapPicker({ initialLat, initialLng, onSelect, onClose }) {
  const [position, setPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-fade-in">
      <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm z-10">
        <h3 className="font-bold text-slate-800 text-lg">Chọn vị trí đích</h3>
        <button onClick={onClose} className="text-slate-500 font-bold p-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200">
          Hủy
        </button>
      </div>
      <div className="flex-1 relative">
        <MapContainer
          center={position || { lat: 21.0285, lng: 105.8542 }} // Default Hanoi
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Bản đồ đường phố (Google)">
              <TileLayer
                attribution='&copy; Google Maps'
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Bản đồ Vệ tinh (Google)">
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
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
        
        {/* Overlays */}
        <div className="absolute top-4 left-4 right-4 z-[400] pointer-events-none text-center drop-shadow-md">
           <span className="bg-slate-900/80 text-white px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-sm shadow">
             Chạm vào bản đồ để ghim vị trí
           </span>
        </div>

        <div className="absolute bottom-6 left-4 right-4 z-[400] pointer-events-none">
           <div className="bg-white/95 backdrop-blur shadow-xl rounded-2xl p-4 text-center pointer-events-auto border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-3">
                {position ? `Đã chọn: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Chưa chọn vị trí'}
              </p>
              <button 
                onClick={() => {
                  if (position) onSelect(position.lat, position.lng);
                }}
                disabled={!position}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:bg-slate-300 shadow-md shadow-brand-500/20 active:scale-95 transition"
              >
                Xác nhận điểm đến
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
