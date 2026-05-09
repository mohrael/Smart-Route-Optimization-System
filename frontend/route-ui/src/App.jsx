import { useState, useEffect, useRef } from 'react'
import MapComponent from './MapComponent'

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc4NDI4MzcxLCJpYXQiOjE3NzgzNDE5NzEsImp0aSI6IjRkNDRhZDM3ZTkzNjQ0YmE5YjliNjY4NTI4YWIyMDM1IiwidXNlcl9pZCI6IjEifQ.uu4P1k2a6lJcXHXot2let-9gC0bWdUxS1aLgDoBWr2M"

const locLabel = (loc) => {
  if (!loc) return ''
  if (loc.name) return loc.name.split(',')[0]
  return `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}`
}

const PIN_COLORS = { start: '#22c55e', dest: '#3b82f6', end: '#ef4444' }

export default function App() {
  const [startLocation, setStartLocation] = useState(null)
  const [destinations, setDestinations]   = useState([])
  const [error, setError]                 = useState('')
  const [result, setResult]               = useState(null)
  const [loading, setLoading]             = useState(false)
  const [locations, setLocations]         = useState([])
  const [pathLocation, setPathLocation]   = useState([])
  const [totalDistance, setTotalDistance] = useState(null)
  const [roadPath, setRoadPath]           = useState([])
  const [search, setSearch]               = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [panelOpen, setPanelOpen]         = useState(true)
  const [userLocation, setUserLocation]   = useState(null)
  const [directions, setDirections]       = useState([]) // Holds text instructions
  const [isTracking, setIsTracking]       = useState(false) // Toggle tracking on/off
  const watchIdRef                        = useRef(null) // Keeps track of the GPS sensor



  async function loadLocations() {
    try {
      const res = await fetch('http://127.0.0.1:8000/location/get_locations/', {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) setLocations(data)
    } catch { /* silent */ }
  }

  async function fetchPathLocations(id) {
    try {
      const res = await fetch(`http://127.0.0.1:8000/routes/location_path/${id}/`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        setPathLocation(data.path || [])
        setTotalDistance(data.total_distance_km ?? null)
      }
    } catch { /* silent */ }
  }

  async function fetchRoadPath(start, dests) {
    try {
      const coords = [start, ...dests].map(p => `${p.lon},${p.lat}`).join(';')
      
      // We added &steps=true to the end of this URL!
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
      )
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.[0]) return []

      const steps = data.routes[0].legs.flatMap(leg => leg.steps)
      const parsedDirections = steps.map((step, index) => {
        const action = step.maneuver.type === 'turn' ? `Turn ${step.maneuver.modifier}` : step.maneuver.type
        const road = step.name ? `onto ${step.name}` : 'ahead'
        const dist = step.distance > 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${step.distance.toFixed(0)} m`
        return { id: index, text: `${action} ${road}`, dist }
      }).filter(d => d.text !== 'arrive ahead') 
      
      setDirections(parsedDirections)

      return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
    } catch { return [] }
  }
  useEffect(() => {
    loadLocations()
    // getCurrentLocation()
  }, [])

  const resetRoute = () => {
    setPathLocation([])
    setResult(null)
    setTotalDistance(null)
    setError('')
    setRoadPath([])
  }
  // const getCurrentLocation = async () => {
  //   if (!navigator.geolocation) {
  //     setError('Geolocation is not supported')
  //     return
  //   }

  //   setSearchLoading(true) 

  //   navigator.geolocation.getCurrentPosition(
  //     async (position) => {
  //       const lat = position.coords.latitude;
  //       const lon = position.coords.longitude;
  //       let placeName = 'My Location'; // Fallback name

  //       try {
  //         const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
  //         const data = await res.json();
          
  //         if (data && data.address) {
  //           placeName = data.address.road || data.address.neighbourhood || data.address.suburb || data.name || 'My Location';
  //         }
  //       } catch (err) {
  //         console.error("Could not fetch street name:", err);
  //       }

  //       const loc = { 
  //         name: placeName,
  //         lat: lat, 
  //         lon: lon 
  //       }

  //       setUserLocation(loc)
  //       handleSelectLocation(loc)
  //       setSearchLoading(false)
  //     },
  //     (err) => {
  //       setSearchLoading(false)
  //       console.error(err)
  //       switch(err.code) {
  //         case 1: setError('Location permission denied.'); break;
  //         case 2: setError('Position unavailable. Ensure GPS is on.'); break;
  //         case 3: setError('Location request timed out.'); break;
  //         default: setError('Unknown location error.'); break;
  //       }
  //     },
  //     {
  //       enableHighAccuracy: true,
  //       timeout: 10000,
  //       maximumAge: 0,
  //     }
  //   )
  // }

const toggleTracking = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return
    }

    // Optional: Set loading state so the user knows it's thinking
    setSearchLoading(true) 

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let placeName = 'My Location'; // Fallback name

        // ⚡ REVERSE GEOCODING: Ask OpenStreetMap for the street name
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
          const data = await res.json();
          
          if (data && data.address) {
            // Try to get the most relevant local name (Road, Neighborhood, or Suburb)
            placeName = data.address.road || data.address.neighbourhood || data.address.suburb || data.name || 'My Location';
          }
        } catch (err) {
          console.error("Could not fetch street name:", err);
        }

        const loc = { 
          name: placeName, // Now it uses the real street name!
          lat: lat, 
          lon: lon 
        }

        setUserLocation(loc)
        handleSelectLocation(loc)
        setSearchLoading(false)
      },
      (err) => {
        setSearchLoading(false)
        console.error(err)
        switch(err.code) {
          case 1: setError('Location permission denied.'); break;
          case 2: setError('Position unavailable. Ensure GPS is on.'); break;
          case 3: setError('Location request timed out.'); break;
          default: setError('Unknown location error.'); break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }  
  const handleSelectLocation = (loc) => {
    if (!startLocation) {
      setStartLocation(loc)
      resetRoute()
      return
    }
    const isSameAsStart = startLocation.id
      ? startLocation.id === loc.id
      : startLocation.lat === loc.lat && startLocation.lon === loc.lon
    if (isSameAsStart) {
      setStartLocation(null)
      setDestinations([])
      resetRoute()
      return
    }
    setDestinations(prev => {
      const exists = prev.some(d =>
        d.id ? d.id === loc.id : d.lat === loc.lat && d.lon === loc.lon
      )
      return exists
        ? prev.filter(d => d.id ? d.id !== loc.id : !(d.lat === loc.lat && d.lon === loc.lon))
        : [...prev, loc]
    })
    resetRoute()
  }

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearchLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`
      )
      const data = await res.json()
      if (data.length === 0) { setError('Place not found.'); return }
      const place = data[0]
      handleSelectLocation({ name: place.display_name, lat: Number(place.lat), lon: Number(place.lon) })
      setSearch('')
    } catch { setError('Search failed.') }
    finally { setSearchLoading(false) }
  }

  const handleSubmit = async () => {
    setError('')
    setResult(null)
    setPathLocation([])
    setLoading(true)

    if (!startLocation) { setError('Set a start point first.'); setLoading(false); return }
    const validDests = destinations.filter(d => d?.lat != null && d?.lon != null)
    if (validDests.length === 0) { setError('Add at least one destination.'); setLoading(false); return }

    try {
      const res = await fetch('http://127.0.0.1:8000/routes/optimize-route/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({
          start_location: { lat: startLocation.lat, lon: startLocation.lon },
          destinations: validDests.map(d => ({ lat: d.lat, lon: d.lon })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.detail || data?.error || 'Request failed.'); return }
      setResult(data)
      if (data.id) await fetchPathLocations(data.id)
      setRoadPath(await fetchRoadPath(startLocation, validDests))
    } catch { setError('Network error. Check backend server.') }
    finally { setLoading(false) }
  }

  const hasRoute = roadPath.length > 0 || pathLocation.length > 0

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif", background: '#0f172a' }}>

      {/* Full-screen map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapComponent
          locations={locations}
          pathLocation={pathLocation}
          roadPath={roadPath}
          startLocation={startLocation}
          destinations={destinations}
          onSelectLocation={handleSelectLocation}
          userLocation={userLocation}
        />
      </div>

      {/* Top search bar */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        width: 'min(520px, calc(100vw - 32px))',
        background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(16px)',
        borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        zIndex: 1000,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search for a place..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#f1f5f9', fontSize: 14, caretColor: '#3b82f6',
          }}
        />
        {search && (
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            style={{
              background: '#3b82f6', border: 'none', borderRadius: 8,
              color: 'white', fontSize: 12, fontWeight: 600,
              padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {searchLoading ? '...' : 'Go'}
          </button>
        )}
      </div>

      {/* Mode hint when nothing selected */}
      {!startLocation && (
        <div style={{
          position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 10, padding: '8px 16px', zIndex: 1000,
          fontSize: 13, color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          Tap the map or search to set your <span style={{ color: '#22c55e', fontWeight: 600 }}>start point</span>
        </div>
      )}
      {startLocation && destinations.length === 0 && (
        <div style={{
          position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 10, padding: '8px 16px', zIndex: 1000,
          fontSize: 13, color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          Now tap to add <span style={{ color: '#3b82f6', fontWeight: 600 }}>destinations</span>
        </div>
      )}

      {/* Bottom panel toggle button */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        style={{
          position: 'absolute', bottom: panelOpen ? 308 : 20, right: 20,
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#94a3b8', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'bottom 0.35s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 1001,
        }}
      >
        {panelOpen ? '↓' : '↑'}
      </button>

      {/* Bottom slide-up panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 300,
        transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        background: 'rgba(15,23,42,0.96)', backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', gap: 16 }}>

          {/* Left: waypoints */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Start row */}
            {startLocation ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIN_COLORS.start, flexShrink: 0, boxShadow: `0 0 8px ${PIN_COLORS.start}` }} />
                <span style={{ flex: 1, fontSize: 13, color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {locLabel(startLocation)}
                </span>
                <button onClick={() => { setStartLocation(null); setDestinations([]); resetRoute() }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px dashed ${PIN_COLORS.start}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#475569' }}>Tap map to set start</span>
              </div>
            )}

            {/* Connector line */}
            {(startLocation || destinations.length > 0) && (
              <div style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.1)', marginLeft: 4 }} />
            )}

            {/* Destinations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: i === destinations.length - 1 ? PIN_COLORS.end : PIN_COLORS.dest,
                    boxShadow: `0 0 8px ${i === destinations.length - 1 ? PIN_COLORS.end : PIN_COLORS.dest}`,
                  }} />
                  <span style={{ flex: 1, fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {locLabel(dest)}
                  </span>
                  <button onClick={() => { setDestinations(p => p.filter((_, j) => j !== i)); resetRoute() }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                </div>
              ))}
              {destinations.length === 0 && startLocation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px dashed ${PIN_COLORS.end}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#475569' }}>Tap map to add destinations</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* Right: action + result */}
          <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
            {/* user location */}
            <button
              onClick={toggleTracking}
              style={{
                background: isTracking ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', 
                border: `1px solid ${isTracking ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
                borderRadius: 10, 
                color: isTracking ? '#ef4444' : '#22c55e', 
                fontSize: 12, fontWeight: 600,
                padding: '8px 0', cursor: 'pointer', width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: 'currentColor',
                animation: isTracking ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none'
              }} />
              {isTracking ? 'Stop Tracking' : 'Start Live Tracking'}
            </button>    
            {result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Distance</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
                      {totalDistance != null ? `${totalDistance}` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569' }}>km</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stops</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{destinations.length}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>points</div>
                  </div>
                </div>
                <button
                  onClick={() => { setStartLocation(null); setDestinations([]); resetRoute() }}
                  style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 600,
                    padding: '9px 0', cursor: 'pointer', width: '100%',
                  }}
                >
                  Clear route
                </button>
                {directions.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Directions</div>
                    {directions.map((dir) => (
                      <div key={dir.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#cbd5e1', textTransform: 'capitalize' }}>{dir.text}</span>
                        <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, flexShrink: 0 }}>{dir.dist}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !startLocation || destinations.length === 0}
                  style={{
                    background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    border: 'none', borderRadius: 12, color: 'white',
                    fontSize: 14, fontWeight: 700, padding: '13px 0',
                    cursor: (!startLocation || destinations.length === 0) ? 'not-allowed' : 'pointer',
                    opacity: (!startLocation || destinations.length === 0) ? 0.4 : 1,
                    width: '100%', letterSpacing: '0.02em',
                    boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
                  }}
                >
                  {loading ? 'Routing...' : '→ Get Route'}
                </button>
                {error && (
                  <p style={{ color: '#f87171', fontSize: 12, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>{error}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}