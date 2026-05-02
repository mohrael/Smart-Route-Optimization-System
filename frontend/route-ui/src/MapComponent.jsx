import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const makeIcon = (color, label) => L.divIcon({
  className: '',
  html: `
    <div style="
      background: ${color};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 11px; font-weight: 700;">${label}</span>
    </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
})

const startIcon = makeIcon('#16a34a', 'S')
const endIcon   = makeIcon('#dc2626', 'E')
const destIcon  = makeIcon('#2563eb', 'D')
const dotIcon   = makeIcon('#9ca3af', '·')

function FitBounds({ positions, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (!trigger) return 
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
    } else if (positions.length === 1) {
      map.setView(positions[0], 13)
    }
  }, [trigger])
  return null
}

function AnimatedPolyline({ positions }) {
  const map = useMap()
  const lineRef = useRef(null)

  useEffect(() => {
    if (lineRef.current) {
      map.removeLayer(lineRef.current)
      lineRef.current = null
    }
    if (positions.length < 2) return

    const line = L.polyline([], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      dashArray: '8 6',
      lineJoin: 'round',
    }).addTo(map)
    lineRef.current = line

    let i = 0
    const timer = setInterval(() => {
      if (i < positions.length) {
        line.addLatLng(positions[i])
        i++
      } else {
        clearInterval(timer)
        line.setStyle({ dashArray: null })
      }
    }, 60)

    return () => {
      clearInterval(timer)
      if (lineRef.current) map.removeLayer(lineRef.current)
    }
  }, [positions, map])

  return null
}

const defaultCenter = [30.0444, 31.2357]

export default function MapComponent({ locations = [], path = [], startId = null, destinationIDs = [], onSelectLocation }) {

  
  const startNum = startId ? Number(startId) : null
  const destNums = destinationIDs.map(Number).filter(Boolean)
  
  const isEnd = (id) => destNums[destNums.length - 1] === id


  const pathIds = path.map(l => l.id)
  const hasPath = path.length > 0
  const pathStartId = hasPath ? pathIds[0] : null
  // const pathEndId   = hasPath ? pathIds[pathIds.length - 1] : null
  const pathSet     = new Set(pathIds)

  const bgLocations = hasPath
    ? locations.filter(l => !pathSet.has(l.id))
    : locations

  const getIcon = (id) => {
    if (hasPath) {
      if (id === pathStartId) return startIcon
      if (isEnd(id))   return endIcon
      if (pathSet.has(id))    return destIcon
      return dotIcon
    }
    // Pre-route: show selections
    if (id === startNum)           return startIcon
    if(isEnd(id)) return endIcon
    if (destNums.includes(id))     return destIcon
    return dotIcon
  }

  const getLabel = (id) => {
    if (hasPath) {
      if (id === pathStartId) return 'Start'
      if (isEnd(id))   return 'End'
      if (pathSet.has(id))    return 'Stop'
    } else {
      if (id === startNum)        return 'Start'
      if (isEnd(id))   return 'End'
      if (destNums.includes(id))  return 'Destination'
    }
    return 'Location'
  }

  const getLabelColor = (id) => {
    if (hasPath) {
      if (id === pathStartId) return '#16a34a'
      if (isEnd(id))   return '#dc2626'
      if (pathSet.has(id))    return '#2563eb'
    } else {
      if (id === startNum)        return '#16a34a'
      if (destNums.includes(id))  return '#2563eb'
    }
    return '#9ca3af'
  }

  const fitPositions = hasPath
    ? path.map(l => [l.latitude, l.longitude])
    : locations.map(l => [l.latitude, l.longitude])

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      <FitBounds positions={fitPositions} trigger={hasPath} />

      {/* Background locations (not on path) */}
      {bgLocations.map(loc => (
        <Marker
          key={`bg-${loc.id}`}
          position={[loc.latitude, loc.longitude]}
          icon={getIcon(loc.id)}
          eventHandlers={{ click: () => onSelectLocation?.(loc.id) }}
        >
          <Popup>
            <div style={{ minWidth: '110px' }}>
              <span style={{
                display: 'inline-block',
                background: getLabelColor(loc.id),
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '99px',
                marginBottom: '4px'
              }}>
                {getLabel(loc.id)}
              </span>
              <div style={{ fontWeight: 600 }}>{loc.name}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>ID: {loc.id}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Path markers (on top) */}
      {hasPath && path.map((loc) => (
        <Marker
          key={`path-${loc.id}`}
          position={[loc.latitude, loc.longitude]}
          icon={getIcon(loc.id)}
          zIndexOffset={loc.id === pathStartId || loc.id === isEnd(loc.id) ? 1000 : 500}
        >
          <Popup>
            <div style={{ minWidth: '110px' }}>
              <span style={{
                display: 'inline-block',
                background: getLabelColor(loc.id),
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '99px',
                marginBottom: '4px'
              }}>
                {getLabel(loc.id)}
              </span>
              <div style={{ fontWeight: 600 }}>{loc.name}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>
                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {hasPath && <AnimatedPolyline positions={path.map(l => [l.latitude, l.longitude])} />}
    </MapContainer>
  )
}