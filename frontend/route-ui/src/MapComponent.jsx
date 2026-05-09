import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const makeIcon = (color, label, pulse = false) => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:32px;height:32px;">
      ${pulse ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s ease-out infinite;"></div>` : ''}
      <div style="
        position:absolute;inset:0;
        background:${color};
        color:white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid rgba(255,255,255,0.9);
        box-shadow:0 3px 12px rgba(0,0,0,0.4),0 0 0 1px ${color}40;
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:11px;font-weight:800;letter-spacing:-0.5px;">${label}</span>
      </div>
    </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
})

const makeSmallDot = (color) => L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

const startIcon = makeIcon('#22c55e', 'S', true)
const endIcon   = makeIcon('#ef4444', 'E')
const destIcon  = makeIcon('#3b82f6', 'D')
const dotIcon   = makeSmallDot('#64748b')

const getDistance = (p1, p2) => Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

function FitBounds({ positions, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (!trigger || positions.length === 0) return
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [80, 80], maxZoom: 15 })
    } else {
      map.setView(positions[0], 14)
    }
  }, [trigger])
  return null
}


function RoutePolyline({ positions }) {
  const map = useMap()
  const refs = useRef({ line: null, outline: null })

  useEffect(() => {
    if (refs.current.line)    { map.removeLayer(refs.current.line);    refs.current.line = null }
    if (refs.current.outline) { map.removeLayer(refs.current.outline); refs.current.outline = null }
    if (positions.length < 2) return

    // Outline (glow effect)
    refs.current.outline = L.polyline(positions, {
      color: '#1d4ed8', weight: 8, opacity: 0.3, lineJoin: 'round', lineCap: 'round',
    }).addTo(map)

    // Main line — animate in
    const line = L.polyline([], {
      color: '#3b82f6', weight: 4, opacity: 1,
      lineJoin: 'round', lineCap: 'round',
    }).addTo(map)
    refs.current.line = line

    let i = 0
    const timer = setInterval(() => {
      if (i < positions.length) { line.addLatLng(positions[i]); i++ }
      else clearInterval(timer)
    }, 8)

    return () => {
      clearInterval(timer)
      if (refs.current.line)    { map.removeLayer(refs.current.line);    refs.current.line = null }
      if (refs.current.outline) { map.removeLayer(refs.current.outline); refs.current.outline = null }
    }
  }, [positions, map])

  return null
}

function MapClickHandler({ onSelectLocation }) {
  useMapEvent('click', e => {
    onSelectLocation?.({ lat: e.latlng.lat, lon: e.latlng.lng })
  })
  return null
}


function FlyToUser({ userLocation }) {
  const map = useMap()
  const flewRef = useRef(false)

  useEffect(() => {
    if (!userLocation || flewRef.current) return
    flewRef.current = true
    map.flyTo([userLocation.lat, userLocation.lon], 15, { duration: 1.8 })
  }, [userLocation, map])

  return null
}

const defaultCenter = [30.0444, 31.2357]

export default function MapComponent({
  locations = [],
  pathLocation = [],
  roadPath = [],
  startLocation = null,
  destinations = [],
  onSelectLocation,
  userLocation = null,
}) {
  const hasPath = roadPath.length > 0 || pathLocation.length > 0

  // Build display path — prefer OSRM road path, fall back to OSM nodes
  let displayPath = roadPath.length > 0
    ? roadPath
    : pathLocation.map(l => [l.latitude, l.longitude])

  // Snap endpoints to exact user pins
  if (hasPath && displayPath.length >= 2) {
    if (startLocation) {
      const pin = [startLocation.lat, startLocation.lon]
      const d1 = getDistance(pin, displayPath[1])
      const d0 = getDistance(displayPath[0], displayPath[1])
      if (d1 < d0) displayPath = displayPath.slice(1)
      displayPath = [pin, ...displayPath]
    }
    const lastDest = destinations[destinations.length - 1]
    if (lastDest) {
      const pin = [lastDest.lat, lastDest.lon]
      const n = displayPath.length
      const dPrev = getDistance(displayPath[n - 2], pin)
      const dLast = getDistance(displayPath[n - 2], displayPath[n - 1])
      if (dPrev < dLast) displayPath = displayPath.slice(0, -1)
      displayPath = [...displayPath, pin]
    }
  }

  const isStart = (loc) => {
    if (!startLocation) return false
    if (startLocation.id && loc.id) return startLocation.id === loc.id
    return Math.abs(startLocation.lat - loc.latitude) < 0.0001 &&
           Math.abs(startLocation.lon - loc.longitude) < 0.0001
  }
  const isLastDest = (loc) => {
    const last = destinations[destinations.length - 1]
    if (!last) return false
    if (last.id && loc.id) return last.id === loc.id
    return Math.abs(last.lat - loc.latitude) < 0.0001 &&
           Math.abs(last.lon - loc.longitude) < 0.0001
  }
  const isDest = (loc) => destinations.some(d =>
    d.id && loc.id ? d.id === loc.id :
    Math.abs(d.lat - loc.latitude) < 0.0001 && Math.abs(d.lon - loc.longitude) < 0.0001
  )

  const getIconForLoc = (loc) => {
    if (isStart(loc))    return startIcon
    if (isLastDest(loc)) return endIcon
    if (isDest(loc))     return destIcon
    return dotIcon
  }

  // Freehand markers (map clicks not on a DB location)
  const startMarker = startLocation && !locations.some(l => isStart(l)) ? startLocation : null
  const destMarkers = destinations.filter(d =>
    !locations.some(l =>
      (l.id && d.id && l.id === d.id) ||
      (Math.abs(l.latitude - d.lat) < 0.0001 && Math.abs(l.longitude - d.lon) < 0.0001)
    )
  )

  return (
    <>
      <style>{`
        @keyframes ping {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-container { background: #ffffff; }
      `}</style>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* Dark map tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
          attribution='&copy; CartoDB'
        />

        <MapClickHandler onSelectLocation={onSelectLocation} />
        <FlyToUser userLocation={userLocation} />
        <FitBounds positions={displayPath} trigger={hasPath} />

      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lon]}
          icon={makeIcon('#22c55e', '●', true)}
          zIndexOffset={2000}
        >
          <Popup>
            <div style={{ fontSize: 13, fontWeight: 600 }}>You are here</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {userLocation.lat.toFixed(5)}, {userLocation.lon.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      )}

        {/* DB location markers */}
        {locations.map(loc => (
          <Marker
            key={`loc-${loc.id}`}
            position={[loc.latitude, loc.longitude]}
            icon={getIconForLoc(loc)}
            eventHandlers={{
              click: () => onSelectLocation?.({ id: loc.id, name: loc.name, lat: loc.latitude, lon: loc.longitude })
            }}
          >
            <Popup className="dark-popup">
              <div style={{ fontWeight: 600, fontSize: 13 }}>{loc.name}</div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>ID: {loc.id}</div>
            </Popup>
          </Marker>
        ))}

        {/* Freehand start */}
        {startMarker && (
          <Marker
            position={[startMarker.lat, startMarker.lon]}
            icon={startIcon}
            eventHandlers={{ click: () => onSelectLocation?.(startMarker) }}
          >
            <Popup><div style={{ fontSize: 13, fontWeight: 600 }}>Start</div><div style={{ fontSize: 11, color: '#64748b' }}>{startMarker.lat.toFixed(5)}, {startMarker.lon.toFixed(5)}</div></Popup>
          </Marker>
        )}

        {/* Freehand destinations */}
        {destMarkers.map((d, i) => (
          <Marker
            key={`dfree-${i}`}
            position={[d.lat, d.lon]}
            icon={i === destinations.length - 1 ? endIcon : destIcon}
            eventHandlers={{ click: () => onSelectLocation?.(d) }}
          >
            <Popup><div style={{ fontSize: 13, fontWeight: 600 }}>Destination {i + 1}</div><div style={{ fontSize: 11, color: '#64748b' }}>{d.lat.toFixed(5)}, {d.lon.toFixed(5)}</div></Popup>
          </Marker>
        ))}
        {/* Route line */}
        {hasPath && <RoutePolyline positions={displayPath} />}
      </MapContainer>
    </>
  )
}