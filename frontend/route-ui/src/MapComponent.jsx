import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvent } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useMemo, useCallback, memo } from 'react'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const makeIcon = (color, label, pulse = false) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:32px;">
    ${pulse ? `<div style="position:absolute;inset:-8px;border-radius:50%;background:${color};opacity:0.2;animation:ping 1.5s ease-out infinite;"></div>` : ''}
    <div style="position:absolute;inset:0;background:${color};color:white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 3px 12px rgba(0,0,0,0.35),0 0 0 1px ${color}30;display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:11px;font-weight:800;">${label}</span>
    </div>
  </div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34],
})

const makeDot = (color) => L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [10, 10], iconAnchor: [5, 5],
})

const userDotIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="position:absolute;inset:-8px;border-radius:50%;background:#3b82f6;opacity:0.2;animation:ping 2s ease-out infinite;"></div>
    <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);"></div>
  </div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})

const startIcon = makeIcon('#22c55e', 'S', true)
const endIcon   = makeIcon('#ef4444', 'E')
const destIcon  = makeIcon('#3b82f6', 'D')
const dotIcon   = makeDot('#94a3b8')

function FitBounds({ positions, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (!trigger || !positions.length) return
    if (positions.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [80, 80], maxZoom: 15 })
    else map.setView(positions[0], 14)
  }, [trigger])
  return null
}

function RoutePolyline({ positions }) {
  const map = useMap()
  const refs = useRef({ line: null, outline: null })

  useEffect(() => {
    if (refs.current.outline) { map.removeLayer(refs.current.outline); refs.current.outline = null }
    if (refs.current.line)    { map.removeLayer(refs.current.line);    refs.current.line = null }
    if (positions.length < 2) return

    refs.current.outline = L.polyline(positions, { color:'#ffffff', weight:12, opacity:0.35, lineJoin:'round', lineCap:'round' }).addTo(map)

    const line = L.polyline([], { color:'#757493', weight:6, opacity:1, lineJoin:'round', lineCap:'round' }).addTo(map)
    refs.current.line = line

    let i = 0
    const batch = Math.max(4, Math.floor(positions.length / 100))
    let rafId = null

    const animate = () => {
      for (let b = 0; b < batch && i < positions.length; b++, i++) {
        line.addLatLng(positions[i])
      }
      if (i < positions.length) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (refs.current.outline) { map.removeLayer(refs.current.outline); refs.current.outline = null }
      if (refs.current.line)    { map.removeLayer(refs.current.line);    refs.current.line = null }
    }
  }, [positions, map])

  return null
}

function TrackingTrail({ path }) {
  const map = useMap()
  const ref = useRef(null)

  useEffect(() => {
    if (!path.length) return
    if (!ref.current) {
      ref.current = L.polyline(path, { color:'#22c55e', weight:3, opacity:0.7, dashArray:'6 4', lineJoin:'round' }).addTo(map)
    } else {
      ref.current.setLatLngs(path)
    }
    return () => { if (ref.current) { map.removeLayer(ref.current); ref.current = null } }
  }, [path, map])

  return null
}

function FlyToUser({ userLocation }) {
  const map = useMap()
  const flewRef = useRef(false)
  useEffect(() => {
    if (!userLocation || flewRef.current) return
    flewRef.current = true
    map.flyTo([userLocation.lat, userLocation.lon], 15, { duration: 1.6 })
  }, [userLocation, map])
  return null
}

function MapClickHandler({ onSelectLocation }) {
  useMapEvent('click', e => onSelectLocation?.({ lat: e.latlng.lat, lon: e.latlng.lng }))
  return null
}

const defaultCenter = [30.0444, 31.2357]

const LocationMarker = memo(({ loc, onSelect, icon }) => (
  <Marker position={[loc.latitude, loc.longitude]} icon={icon}
    eventHandlers={{ click: () => onSelect?.({ id: loc.id, name: loc.name, lat: loc.latitude, lon: loc.longitude }) }}>
    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{loc.name || 'Location'}</div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>Location</div>
    </Tooltip>
    <Popup>
      <div style={{ fontWeight:600, fontSize:13 }}>{loc.name}</div>
      <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>ID: {loc.id}</div>
    </Popup>
  </Marker>
))

const WaypointMarker = memo(({ position, icon, label, onSelect, kind }) => (
  <Marker position={position} icon={icon} eventHandlers={{ click: () => onSelect?.(label) }}>
    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{label?.name || label}</div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{kind}</div>
    </Tooltip>
    <Popup>
      <div style={{ fontWeight:600, fontSize:13 }}>{label.name || label}</div>
      <div style={{ fontSize:11, color:'#64748b' }}>{position[0].toFixed(5)}, {position[1].toFixed(5)}</div>
    </Popup>
  </Marker>
))

function MapReady({ onMapReady }) {
  const map = useMap()
  useEffect(() => {
    if (onMapReady) onMapReady(map)
  }, [map, onMapReady])
  return null
}

export default function MapComponent({
  locations = [], pathLocation = [], roadPath = [],
  startLocation = null, destinations = [],
  onSelectLocation, userLocation = null, smoothPath = [],
  onMapReady,
}) {
  const hasPath = roadPath.length > 0 || pathLocation.length > 0
  const displayPath = useMemo(() =>
    roadPath.length > 0 ? roadPath : pathLocation.map(l => [l.latitude, l.longitude]),
    [roadPath, pathLocation]
  )

  const getIcon = useCallback((loc) => {
    if (startLocation && startLocation.id && loc.id && startLocation.id === loc.id) return startIcon
    if (startLocation && !startLocation.id && Math.abs(startLocation.lat - loc.latitude) < 0.0001 && Math.abs(startLocation.lon - loc.longitude) < 0.0001) return startIcon
    const last = destinations[destinations.length - 1]
    if (last && (last.id && loc.id && last.id === loc.id || !last.id && Math.abs(last.lat - loc.latitude) < 0.0001 && Math.abs(last.lon - loc.longitude) < 0.0001)) return endIcon
    if (destinations.some(d => d.id && loc.id && d.id === loc.id || !d.id && Math.abs(d.lat - loc.latitude) < 0.0001 && Math.abs(d.lon - loc.longitude) < 0.0001)) return destIcon
    return dotIcon
  }, [startLocation, destinations])

  const filteredLocations = useMemo(() => locations.filter(l => {
    if (startLocation && (startLocation.id && l.id && startLocation.id === l.id || !startLocation.id && Math.abs(startLocation.lat - l.latitude) < 0.0001 && Math.abs(startLocation.lon - l.longitude) < 0.0001)) return false
    if (destinations.some(d => d.id && l.id && d.id === l.id || !d.id && Math.abs(d.lat - l.latitude) < 0.0001 && Math.abs(d.lon - l.longitude) < 0.0001)) return false
    return true
  }), [locations, startLocation, destinations])

  const startMarker = useMemo(() => startLocation && !locations.some(l => startLocation.id && l.id && startLocation.id === l.id || !startLocation.id && Math.abs(startLocation.lat - l.latitude) < 0.0001 && Math.abs(startLocation.lon - l.longitude) < 0.0001) ? startLocation : null, [startLocation, locations])

  return (
    <>
      <style>{`
        @keyframes ping { 0%{transform:scale(0.8);opacity:0.7} 100%{transform:scale(2.4);opacity:0} }
        .leaflet-container { background: #e8e0d8; }
        .leaflet-popup-content-wrapper { background: #1e293b; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .leaflet-popup-tip { background: #1e293b; }
        .leaflet-popup-close-button { color: #64748b !important; }
      `}</style>
      <MapContainer center={defaultCenter} zoom={12} style={{ height:'100%', width:'100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />

        <MapReady onMapReady={onMapReady} />
        <MapClickHandler onSelectLocation={onSelectLocation} />
        <FlyToUser userLocation={userLocation} />
        <FitBounds positions={displayPath} trigger={hasPath} />

        {smoothPath.length > 1 && <TrackingTrail path={smoothPath} />}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={userDotIcon} zIndexOffset={3000}>
            <Popup>
              <div style={{ fontWeight:600, fontSize:13 }}>You are here</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{userLocation.lat.toFixed(5)}, {userLocation.lon.toFixed(5)}</div>
            </Popup>
          </Marker>
        )}

        {filteredLocations.map(loc => (
          <LocationMarker key={`loc-${loc.id}`} loc={loc} icon={getIcon(loc)} onSelect={onSelectLocation} />
        ))}

        {startMarker && (
          <WaypointMarker position={[startMarker.lat, startMarker.lon]} icon={startIcon} label={startMarker} kind="Start" onSelect={onSelectLocation} />
        )}

        {destinations.map((d, i) => (
          <WaypointMarker key={`dfree-${i}`} position={[d.lat, d.lon]} icon={i === destinations.length - 1 ? endIcon : destIcon} label={d} kind={i === destinations.length - 1 ? 'Destination' : `Stop ${i + 1}`} onSelect={() => onSelectLocation?.(d)} />
        ))}

        {hasPath && <RoutePolyline positions={displayPath} />}
      </MapContainer>
    </>
  )
}