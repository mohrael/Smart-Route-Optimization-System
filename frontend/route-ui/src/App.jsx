import { useState, useEffect, useRef, useCallback } from 'react'
import MapComponent from './MapComponent'
import './App.css'

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
  const [etaMinutes, setEtaMinutes]       = useState(null)
  const [distanceMeters, setDistanceMeters] = useState(null)
  const [roadPath, setRoadPath]           = useState([])
  const [search, setSearch]               = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [panelOpen, setPanelOpen]         = useState(false)
  const [userLocation, setUserLocation]   = useState(null)
  const [directions, setDirections]       = useState([])
  const [isTracking, setIsTracking]       = useState(false)
  const watchIdRef                        = useRef(null)
  const mapRef                            = useRef(null)
  const [history, setHistory]             = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [algorithm, setAlgorithm] = useState('TSP')
  const [needsRecalc, setNeedsRecalc] = useState(false)

  const [activeTab, setActiveTab] = useState('route')
  const [favorites, setFavorites] = useState([])
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const TABS = ['route', 'favorites', 'history']

  // --- Authentication states ---
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('accessToken') || '')
  const isAuthenticated = Boolean(authToken)
  const [showAuthModal, setShowAuthModal] = useState(false) // <-- NEW: Controls the login popup
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const authHeaders = () => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {}
  }
  
  const persistAuth = (accessToken, refreshToken) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
      setAuthToken(accessToken)
    } else {
      localStorage.removeItem('accessToken')
      setAuthToken('')
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken)
    } else {
      localStorage.removeItem('refreshToken')
    }
  }

  // <-- NEW: Helper to check auth and show modal if needed
  const requireAuth = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return false
    }
    return true
  }

  const handleLogin = async () => {
    setAuthBusy(true)
    setAuthMessage('')
    try {
      const res = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        persistAuth(data.access, data.refresh)
        setAuthMessage('Logged in successfully.')
        setShowAuthModal(false) // Close modal on success!
      } else {
        setAuthMessage(data.detail || 'Invalid credentials.')
      }
    } catch (error) {
      setAuthMessage('Unable to reach the auth server.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignup = async () => {
    setAuthBusy(true)
    setAuthMessage('')
    try{
      const res = await fetch('http://127.0.0.1:8000/user/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername,
          email: authEmail,
          password: authPassword,
          confirm_password: authConfirmPassword,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setAuthMessage(data?.message || 'Account created successfully. You can now log in.')
        setAuthMode('login')
        setAuthPassword('')
        setAuthConfirmPassword('')
      } else {
        const firstError = Object.values(data || {}).flat().find(Boolean)
        setAuthMessage(firstError || 'Signup failed. Please check your input.')
      }
    } catch (error) {
      setAuthMessage('Unable to reach the auth server.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = () => { 
    persistAuth('', '')
    setAuthMessage('')
    setFavorites([])
    setHistory([])
    setActiveTab('route')
    // setResult(null)
    // setRoadPath([])
    // setDirections([])
    // setStartLocation(null)
    // setDestinations([])
  }

  const confirmLogout = () => {
    handleLogout()
    setShowLogoutModal(false)
  }

  // --- Favorites ---
  const loadFavorites = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/routes/favorites/', {
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) return
      setFavorites( (data || []).map(fav => ({
        id: fav._id,
        lat: fav.location.lat,
        lon: fav.location.lon,
        name: fav.location.name,
        area: fav.location.area,
        city: fav.location.city
      })))
    } catch (error) { console.error("Error loading favorites:", error) }
  }

  const saveFavorite = async (loc) => {
    if (!requireAuth()) return; // <-- GUARDED

    try {
      const alreadyExists = favorites.some(f =>
        Math.abs(f.lat - loc.lat) < 0.0001 && Math.abs(f.lon - loc.lon) < 0.0001
      )
      if (alreadyExists) return

      const cleanedLocation = {
        name: loc.street || loc.name,
        lat: loc.lat,
        lon: loc.lon,
        area: loc.area || "",
        city: loc.city || "",
      }
      
      const res = await fetch('http://127.0.0.1:8000/routes/favorites/add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ location: cleanedLocation })
      })
      if (res.ok) await loadFavorites()
    } catch (error) { console.error("Error saving favorite:", error) }
  }

  const findFavoriteByLocation = (loc) => {
    if (!loc) return null
    return favorites.find(f => Math.abs(f.lat - loc.lat) < 0.0001 && Math.abs(f.lon - loc.lon) < 0.0001) || null
  }

  const removeFavorite = async (loc) => {
    if (!requireAuth()) return; // <-- GUARDED
    try {
      const favorite = findFavoriteByLocation(loc)
      const favoriteId = favorite?.id || loc?.id
      if (!favoriteId) return

      const res = await fetch('http://127.0.0.1:8000/routes/favorites/remove/',{
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ location_id: favoriteId })
      })
      if (res.ok) setFavorites(prev => prev.filter(f => f.id !== favoriteId))
    } catch (error) { console.error("Error removing favorite:", error) }
  }

  const isFavorited = (loc) => {
    if (!loc) return false
    return favorites.some(f => Math.abs(f.lat - loc.lat) < 0.0001 && Math.abs(f.lon - loc.lon) < 0.0001)
  }

  const toggleFavorite = async (loc) => {
    if (!requireAuth()) return; // <-- GUARDED
    if (!loc) return
    if (isFavorited(loc)) await removeFavorite(loc)
    else await saveFavorite(loc)
  }

  useEffect(() => {
    loadLocations()
    if(!authToken) {
      setFavorites([])
      setHistory([])
      return
    }
    loadFavorites()
    loadHistory()
  }, [authToken])

  const etaFromKm = (km) => {
    const mins = Math.round(Number(km) * 2.5); 
    if (mins < 60) return `${mins} min`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ${mins % 60}m`
  }

  const ETA_TRAFFIC_FACTOR = 1.4

  const etaFromMinutes = (mins) => {
    const safeMins = Math.max(0, Math.round(Number(mins) * ETA_TRAFFIC_FACTOR))
    if (safeMins < 60) return `${safeMins} min`
    const hrs = Math.floor(safeMins / 60)
    return `${hrs}h ${safeMins % 60}m`
  }

  const formatDistance = (km) => {
    if (km == null || Number.isNaN(Number(km))) return { value: '—', unit: '' }
    const safeKm = Number(km)
    if (safeKm < 1) return { value: `${Math.round(safeKm * 1000)}`, unit: 'm' }
    return { value: `${safeKm}`, unit: 'km' }
  }

  const formatDistanceMeters = (meters) => {
    if (meters == null || Number.isNaN(Number(meters))) return { value: '—', unit: '' }
    const safeMeters = Math.max(0, Math.round(Number(meters)))
    if (safeMeters < 1000) return { value: `${safeMeters}`, unit: 'm' }
    return { value: `${(safeMeters / 1000).toFixed(2)}`, unit: 'km' }
  }

  const haversineKm = (a, b) => {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180
    const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
  }

  async function reverseGeocode(lat, lon) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`)
      const d = await res.json()
      const a = d.address || {}
      return {
        street: a.road || a.pedestrian || a.path || '',
        area: a.neighbourhood || a.suburb || a.quarter || '',
        city: a.city || a.town || a.village || a.county || '',
        display: [a.road, a.neighbourhood || a.suburb, a.city || a.town].filter(Boolean).join(', ') || d.display_name?.split(',')[0] || 'Unknown location'
      }
    } catch {
      return { street: '', area: '', city: '', display: 'Unknown location' }
    }
  }

  const loadRoute = async (route) => {
    const start = {
      lat: route.start_location.lat,
      lon: route.start_location.lon,
      name: `${route.start_location.lat.toFixed(4)}, ${route.start_location.lon.toFixed(4)}`
    }
    const dests = (route.destinations || []).map(d => ({
      lat: d.lat,
      lon: d.lon,
      name: `${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}`
    }))

    setStartLocation(start)
    setDestinations(dests)
    setTotalDistance(route.stats?.total_distance_km ?? null)

    if (route.road_path?.length > 0) {
      setRoadPath(route.road_path)
    } else {
      const rp = await fetchRoadPath(start, dests)
      setRoadPath(rp)
    }

    if (route.directions?.length > 0) {
      setDirections(route.directions)
    }

    setResult({ id: null, total_distance_km: route.stats?.total_distance_km })
    setHistoryOpen(false)
  }

  async function loadLocations() {
    try {
      const res = await fetch('http://127.0.0.1:8000/location/get_locations/', {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) setLocations(data)
    } catch { /* silent */ }
  }

  async function loadHistory() {
    try {
      const res = await fetch("http://127.0.0.1:8000/routes/history/", {
        headers: authHeaders(),
      })
      const data = await res.json()
      setHistory(data)
    } catch {
      console.error("Failed to load history")
    }
  }

  async function fetchPathLocations(id) {
    try {
      const res = await fetch(`http://127.0.0.1:8000/routes/location_path/${id}/`, {
        headers: authHeaders(),
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
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
      )
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.[0]) return []

      const durationSec = data.routes[0].duration
      setEtaMinutes(durationSec != null ? durationSec / 60 : null)
      const distanceSec = data.routes[0].distance
      setDistanceMeters(distanceSec != null ? distanceSec : null)

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

  const resetRoute = () => {
    setPathLocation([])
    setResult(null)
    setTotalDistance(null)
    setEtaMinutes(null)
    setDistanceMeters(null)
    setError('')
    setRoadPath([])
    setNeedsRecalc(false)
    setDirections([])
  }

  const handleSelectRoute = async (route) => {
    setSelectedRoute(route)
    await loadRoute(route)
  }

  const toggleTracking = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return
    }
    setSearchLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        let placeName = 'My Location'
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`)
          const data = await res.json()
          if (data?.address) {
            placeName = data.address.road || data.address.neighbourhood || data.address.suburb || data.name || 'My Location'
          }
        } catch (err) {
          console.error("Could not fetch street name:", err)
        }
        const loc = { name: placeName, lat, lon }
        setUserLocation(loc)
        handleSelectLocation(loc)
        setSearchLoading(false)
      },
      (err) => {
        setSearchLoading(false)
        console.error(err)
        switch (err.code) {
          case 1: setError('Location permission denied.'); break
          case 2: setError('Position unavailable. Ensure GPS is on.'); break
          case 3: setError('Location request timed out.'); break
          default: setError('Unknown location error.'); break
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSelectLocation = useCallback(async (loc) => {
    let enriched = loc
    const hasName = loc.name || loc.street

    if (!hasName && loc.lat && loc.lon) {
      try {
        const geo = await reverseGeocode(loc.lat, loc.lon)
        enriched = {
          ...loc,
          ...geo,
          name: geo.display,
        }
      } catch (err) { console.error("Reverse geocoding failed:", err) }
    }

    if (!startLocation) {
      setStartLocation(enriched)
      setPanelOpen(true)
      resetRoute()
      return
    }

    const isSameAsStart = startLocation.id
      ? startLocation.id === enriched.id
      : (startLocation.lat === enriched.lat && startLocation.lon === enriched.lon)

    if (isSameAsStart) {
      setStartLocation(null)
      setDestinations([])
      resetRoute()
      return
    }

    setDestinations(prev => {
      const exists = prev.some(d =>
        d.id ? d.id === enriched.id : (d.lat === enriched.lat && d.lon === enriched.lon)
      )

      if (exists) {
        return prev.filter(d =>
          d.id ? d.id !== enriched.id : !(d.lat === enriched.lat && d.lon === enriched.lon)
        )
      }
      setPanelOpen(true)
      return [...prev, enriched]
    })
    resetRoute()
  }, [startLocation])

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearchLoading(true)
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/routes/search-location/?q=${encodeURIComponent(search)}`,
      )
      const data = await res.json()
      if (data.length === 0) { setError('Place not found.'); return }
      const place = data
      handleSelectLocation({
        name: place.name,
        lat: Number(place.lat),
        lon: Number(place.lon)
      })
      setSearch('')
    } catch { setError('Search failed.') }
    finally { setSearchLoading(false) }
  }

  const handleSubmit = async () => {
    setError('')
    setResult(null)
    setPathLocation([])
    setLoading(true)

    if (!startLocation) { setError('Set a start point.'); setLoading(false); return }
    const validDests = destinations.filter(d => d?.lat != null && d?.lon != null)
    if (validDests.length === 0) { setError('Add at least one destination.'); setLoading(false); return }

    try {
      const res = await fetch('http://127.0.0.1:8000/routes/optimize-route/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          start_location: { lat: startLocation.lat, lon: startLocation.lon },
          destinations: validDests.map(d => ({ lat: d.lat, lon: d.lon })),
          algorithm: algorithm,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.detail || data?.error || 'Request failed.'); return }
      setResult(data)
      // Refresh history (backend saves history asynchronously). Try immediate + delayed retries.
      try {
        loadHistory()
        setTimeout(() => loadHistory(), 1500)
        setTimeout(() => loadHistory(), 3500)
      } catch (e) { /* ignore */ }
      setNeedsRecalc(false)
      if (data.id) await fetchPathLocations(data.id)
      setRoadPath(await fetchRoadPath(startLocation, validDests))
    } catch { setError('Network error. Check backend server.') }
    finally { setLoading(false) }
  }


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif", background: '#0f172a' }}>

      {/* TOP RIGHT LOGIN/LOGOUT BUTTON */}
      <div className="auth-button">
        {isAuthenticated ? (
          <button onClick={() => setShowLogoutModal(true)} style={{ background: 'rgba(239,68,68,0.9)', border: 'none', padding: '8px 16px', borderRadius: 12, color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            Log out
          </button>
        ) : (
          <button onClick={() => setShowAuthModal(true)} style={{ background: 'rgba(59,130,246,0.9)', border: 'none', padding: '8px 16px', borderRadius: 12, color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            Log in
          </button>
        )}
      </div>

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
          onMapReady={(map) => { mapRef.current = map }}
        />
      </div>

      {/* Top search bar */}
      <div className="top-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search for a place..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: '#f1f5f9', fontSize: 14, caretColor: '#3b82f6',
          }}
        />
        
        <select
          value={algorithm}
          onChange={e => {
            const next = e.target.value
            setAlgorithm(next)
            if (result) setNeedsRecalc(true)
          }}
          style={{
            marginLeft: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#f1f5f9', fontSize: 12, borderRadius: 8, padding: '5px 10px',
            cursor: 'pointer', minWidth: 0,
          }}
        >
          <option value="TSP" style={{ color: '#0f172a' }}>TSP (Exact)</option>
          <option value="GREEDY" style={{ color: '#0f172a' }}>Greedy (Fast)</option>
        </select>

        {search && (
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            style={{
              background: '#3b82f6', border: 'none', borderRadius: 8,
              color: 'white', fontSize: 12, fontWeight: 600,
              padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 0,
            }}
          >
            {searchLoading ? '...' : 'Go'}
          </button>
        )}
      </div>

      {/* Mode hints */}
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

      {/* Map zoom buttons */}
      <div
        style={{
          position: 'absolute', right: 20, bottom: panelOpen ? 372 : 90,
          display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1001,
        }}
      >
        <button
          onClick={() => mapRef.current?.zoomIn()} disabled={!mapRef.current}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 18, cursor: mapRef.current ? 'pointer' : 'not-allowed', opacity: mapRef.current ? 1 : 0.5, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()} disabled={!mapRef.current}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 18, cursor: mapRef.current ? 'pointer' : 'not-allowed', opacity: mapRef.current ? 1 : 0.5, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
        >
          −
        </button>
      </div>

      {/* Bottom panel toggle button */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        style={{
          position: 'absolute', bottom: panelOpen ? 308 : 20, right: 20, width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', transition: 'bottom 0.35s cubic-bezier(0.4,0,0.2,1)', zIndex: 1001,
        }}
      >
        {panelOpen ? '↓' : '↑'}
      </button>

      {/* Bottom slide-up panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 300,
        transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px 20px 0 0',
        zIndex: 1000, display: 'flex', flexDirection: 'column',
      }}>
        {/* Toggle button */}
        <button onClick={() => setPanelOpen(!panelOpen)} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', transition: 'background 0.2s' }} />
        </button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 20px 10px' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => {
                // <-- NEW: Intercept clicks to protected tabs
                if ((tab === 'favorites' || tab === 'history') && !requireAuth()) return;
                setActiveTab(tab)
              }} 
              style={{
                flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab ? '#3b82f6' : '#64748b',
                textTransform: 'capitalize',
              }}>
              {tab === 'route' ? '🗺 Route' : tab === 'favorites' ? '⭐ Saved' : '🕒 History'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', gap: 16 }}>

          {/* ── ROUTE TAB ── */}
          {activeTab === 'route' && (
            <>
              {/* Left: waypoints */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Start */}
                {startLocation ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIN_COLORS.start, flexShrink: 0, marginTop: 3, boxShadow: `0 0 8px ${PIN_COLORS.start}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {startLocation.street || locLabel(startLocation)}
                      </div>
                      {(startLocation.area || startLocation.city) && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>{[startLocation.area, startLocation.city].filter(Boolean).join(', ')}</div>
                      )}
                    </div>
                    <button onClick={() => toggleFavorite(startLocation)} title={isFavorited(startLocation) ? "Remove favorite" : "Save favorite"} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>{isFavorited(startLocation) ? '★' : '☆'}</button>
                    <button onClick={() => { setStartLocation(null); setDestinations([]); resetRoute() }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px dashed ${PIN_COLORS.start}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#475569' }}>Tap map to set start</span>
                  </div>
                )}

                {(startLocation || destinations.length > 0) && <div style={{ width: 1, height: 6, background: 'rgba(255,255,255,0.1)', marginLeft: 4 }} />}

                {/* Destinations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
                  {destinations.map((dest, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: i === destinations.length - 1 ? PIN_COLORS.end : PIN_COLORS.dest, boxShadow: `0 0 6px ${i === destinations.length - 1 ? PIN_COLORS.end : PIN_COLORS.dest}` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dest.street || locLabel(dest)}
                        </div>
                        {(dest.area || dest.city) && <div style={{ fontSize: 11, color: '#64748b' }}>{[dest.area, dest.city].filter(Boolean).join(', ')}</div>}
                      </div>
                      <button onClick={() => toggleFavorite(dest)} title={isFavorited(dest) ? "Remove favorite" : "Save favorite"} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>{isFavorited(dest) ? '★' : '☆'}</button>
                      <button onClick={() => { setDestinations(p => p.filter((_, j) => j !== i)); resetRoute() }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                    </div>
                  ))}
                  {!destinations.length && startLocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px dashed ${PIN_COLORS.end}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#475569' }}>Tap to add destinations</span>
                    </div>
                  )}
                </div>

                {/* Directions */}
                {directions.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Turn-by-turn</div>
                    {directions.map((d, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ textTransform: 'capitalize' }}>{d.text}</span>
                        <span style={{ color: '#3b82f6', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{d.dist}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

              {/* Right: controls */}
              <div style={{ width: 176, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-start', paddingTop: 4 }}>

                {/* Live tracking */}
                <button onClick={toggleTracking} style={{
                  background: isTracking ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
                  border: `1px solid ${isTracking ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  borderRadius: 10, color: isTracking ? '#ef4444' : '#22c55e',
                  fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', animation: isTracking ? 'ping 1.5s infinite' : 'none' }} />
                  {isTracking ? 'Stop Tracking' : '📍 Live Track'}
                </button>

                {result ? (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dist</div>
                        {(() => {
                          const dist = distanceMeters != null
                            ? formatDistanceMeters(distanceMeters)
                            : formatDistance(totalDistance)
                          return (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{dist.value}</div>
                              <div style={{ fontSize: 10, color: '#475569' }}>{dist.unit}</div>
                            </>
                          )
                        })()}
                      </div>
                      <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ETA</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{etaMinutes != null ? etaFromMinutes(etaMinutes) : (totalDistance != null ? etaFromKm(totalDistance) : '—')}</div>
                      </div>
                    </div>

                    {needsRecalc && (
                      <button
                        onClick={handleSubmit} disabled={loading}
                        style={{
                          background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                          border: 'none', borderRadius: 10, color: 'white', fontSize: 12, fontWeight: 700, padding: '8px 0',
                          cursor: loading ? 'not-allowed' : 'pointer', width: '100%', letterSpacing: '0.02em',
                        }}
                      >
                        {loading ? 'Routing...' : 'Recalculate Route'}
                      </button>
                    )}

                    {shareUrl && !needsRecalc && (
                      <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied!') }} style={{
                        background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                        borderRadius: 10, color: '#fbbf24', fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%',
                      }}>
                        📍 Copy Share Link
                      </button>
                    )}

                    {!needsRecalc && (
                      <button onClick={() => { setStartLocation(null); setDestinations([]); resetRoute() }} style={{
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 10, color: '#ef4444', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer', width: '100%',
                      }}>
                        Clear route
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={handleSubmit} disabled={loading || !startLocation || !destinations.length} style={{
                      background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                      border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 700,
                      padding: '12px 0', cursor: (!startLocation || !destinations.length) ? 'not-allowed' : 'pointer',
                      opacity: (!startLocation || !destinations.length) ? 0.4 : 1, width: '100%', boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
                    }}>
                      {loading ? 'Routing...' : '→ Get Route'}
                    </button>
                    {error && <p style={{ color: '#f87171', fontSize: 12, margin: 0, textAlign: 'center' }}>{error}</p>}
                  </>
                )}
              </div>
            </>
          )}

          {/* ── FAVORITES TAB ── */}
          {activeTab === 'favorites' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!favorites.length ? (
                <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No saved places yet.<br />Tap ⭐ next to any location to save it.</p>
              ) : favorites.map((fav, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 18 }}>⭐</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.street || fav.name || locLabel(fav)}</div>
                    {(fav.area || fav.city) && <div style={{ fontSize: 11, color: '#64748b' }}>{[fav.area, fav.city].filter(Boolean).join(', ')}</div>}
                  </div>
                  <button onClick={() => handleSelectLocation(fav)} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, color: '#3b82f6', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}>Go</button>
                  <button onClick={() => removeFavorite(fav)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 , overflowY:'auto', paddingRight:4}}>
              {!history.length ? (
                <p style={{ color:'#475569', fontSize:13, textAlign:'center', marginTop:20 }}>No routes calculated yet.</p>
              ) : history.map((route)=>{
                  const isActive = selectedRoute?.id === route.id
                  const date = route.timestamp ? new Date(route.timestamp) : new Date()
                  const dateStr = isNaN(date)?'-': date.toLocaleString([], { month:'short', day:'numeric' })
                  const timeStr = isNaN(date)?'-': date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                  const routeId = route._id ? String(route._id) : String(route.id)

                  return(
                    <div key={routeId} onClick={() => handleSelectRoute(route)} style={{
                      padding:'10px 12px', borderRadius:12, cursor: 'pointer',
                      background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      transition:'all 0.15s ease'
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, alignItems:'center' }}>
                        <span style={{fontSize:13, fontWeight:600, color: isActive? '#93c5fd' : '#f1f5f9'}}> Route #{routeId}</span>
                        <span style={{ fontSize:11, color:'#475569' }}>{dateStr} {timeStr}</span>
                      </div>    

                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {route.start_location?.name || 'Start'}
                        {' → '}
                        {route.destinations?.length || 0 } {destinations.length > 1 ? 'destination' : 'destinations'}
                      </div>

                      <span style={{fontSize: 12,fontWeight: 600, color: isActive ? '#3b82f6' : '#cbd5e1' }}>
                        {route.stats?.total_distance_km ?? '—'} km
                      </span>

                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                        {route.destinations?.length ?? 0} stops
                      </span>
                    </div>
                  )
                })

              }
            </div>
          )}

        </div>
      </div>

      {/* ── AUTHENTICATION MODAL POPUP ── */}
      {showLogoutModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9998, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
          <div style={{ position: 'relative', width: 'min(420px, calc(100vw - 32px))', padding: 24, borderRadius: 24, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', color: '#e2e8f0' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, lineHeight: 1.1 }}>Log out?</h2>
            <p style={{ margin: '0 0 18px', color: '#94a3b8', fontSize: 14 }}>Are you sure you want to log out from your account?</p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.92)', color: 'white', fontWeight: 800, cursor: 'pointer' }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──AUTHENTICATION MODAL POPUP ── */}
      {showAuthModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
          <div style={{ position: 'relative', width: 'min(460px, calc(100vw - 32px))', padding: 24, borderRadius: 24, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', color: '#e2e8f0' }}>
            
            {/* Close Button */}
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 24 }}>
              ×
            </button>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#38bdf8', fontWeight: 700 }}>Delivery Route</div>
              <h1 style={{ margin: '8px 0 6px', fontSize: 24, lineHeight: 1.1 }}>Sign in required</h1>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Please log in to use saved locations and history.</p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setAuthMode('login')} style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: authMode === 'login' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', color: authMode === 'login' ? '#93c5fd' : '#cbd5e1', cursor: 'pointer', fontWeight: 700 }}>Login</button>
              <button onClick={() => setAuthMode('signup')} style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: authMode === 'signup' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)', color: authMode === 'signup' ? '#86efac' : '#cbd5e1', cursor: 'pointer', fontWeight: 700 }}>Sign up</button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <input value={authUsername} onChange={e => setAuthUsername(e.target.value)} placeholder="Username" style={{ width: 'auto', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f8fafc', outline: 'none' }} />
              {authMode === 'signup' && (
                <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" type="email" style={{ width: 'auto', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f8fafc', outline: 'none' }} />
              )}
              <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password" type="password" style={{ width: 'auto', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f8fafc', outline: 'none' }} />
              {authMode === 'signup' && (
                <input value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} placeholder="Confirm password" type="password" style={{ width: 'auto', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f8fafc', outline: 'none' }} />
              )}

              <button
                onClick={authMode === 'login' ? handleLogin : handleSignup}
                disabled={authBusy || !authUsername || !authPassword || (authMode === 'signup' && (!authEmail || !authConfirmPassword))}
                style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: authBusy ? 'rgba(59,130,246,0.45)' : 'linear-gradient(135deg, #2563eb, #38bdf8)', color: 'white', fontWeight: 800, cursor: authBusy ? 'not-allowed' : 'pointer' }}
              >
                {authBusy ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Create account'}
              </button>

              {authMessage && <div style={{ fontSize: 13, color: '#fca5a5', minHeight: 18 }}>{authMessage}</div>}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}