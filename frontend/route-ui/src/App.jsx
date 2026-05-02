import { useState, useEffect, useMemo } from 'react'
import './App.css'
import MapComponent from './MapComponent'

function App() {
  // Always store as numbers (or null/empty)
  const [startLocation, setStartLocation] = useState('')   // string in input, Number when used
  const [destinations, setDestinations] = useState([])     // array of numbers
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState([])
  const [pathLocation, setPathLocation] = useState([])
  const [totalDistance, setTotalDistance] = useState(null)
  const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc3ODA4Nzc5LCJpYXQiOjE3Nzc3MjIzNzksImp0aSI6ImJjNDkyMzQ2ZDIwYjQxNzA5OGQyYTI3M2ZhOGNmODE3IiwidXNlcl9pZCI6IjEifQ.nSz-0AS2bLMi7nhlFFbffcgUAxea28Em5gBYoVoPI3w";


  const locationMap = useMemo(() =>
    Object.fromEntries(locations.map(loc => [loc.id, loc]))
  , [locations])

  // Click a marker on the map to select start then destinations
  const handleSelectLocation = (id) => {
    if (!startLocation ) {
      setStartLocation(String(id))
      setError('')
      return
    }
    // Clicking the current start deselects it
    if (Number(startLocation) === id) {
      setStartLocation('')
      setDestinations([])   // <-- clear destinations too
      setPathLocation([])
      setResult(null)
      return
    }
    // Toggle destination
    setDestinations(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    setError('')
  }

  async function loadLocations() {
    try {
      const response = await fetch('http://127.0.0.1:8000/location/get_locations/', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data?.detail || data?.error || 'Request failed.')
        return
      }
      setLocations(data)
      setError('')
    } catch (err) {
      setError('Network error. Please check backend server.')
      console.error('Failed to load locations:', err)
    }
  }

  async function fetchPathLocations(routeResultId) {
    try {
      const response = await fetch(`http://127.0.0.1:8000/routes/location_path/${routeResultId}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('Failed to fetch path:', data)
        return
      }
      setPathLocation(data.path || [])
      setTotalDistance(data.total_distance_km??null)
    } catch (err) {
      console.error('Network error:', err)
    }
  }

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      await loadLocations()
      if (isMounted) setLoading(false)
    }
    fetchData()
    return () => { isMounted = false }
  }, [])

  // Typed input: update a destination by index
  const handleDestinationChange = (index, value) => {
    const num = value === '' ? '' : Number(value)
    setDestinations(prev => {
      const next = [...prev]
      next[index] = num
      return next
    })
    setPathLocation([])
    setResult(null)
    setTotalDistance(null)
    if (error) setError('')
  }

  const handleStartLocationChange = (value) => {
    setStartLocation(value)
    setPathLocation([])
    setResult(null)
    setTotalDistance(null)
    setError('')
  }

  const handleAdd = () => setDestinations(prev => [...prev, ''])

  const handleRemove = (index) => {
    setDestinations(prev => prev.filter((_, i) => i !== index))
    setPathLocation([])   // reset route
    setTotalDistance(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    setError('')
    setResult(null)
    setPathLocation([])
    setLoading(true)

    const startNum = Number(startLocation)
    if (!startLocation || !Number.isInteger(startNum) || startNum < 1) {
      setError('Start location must be a valid number greater than 0.')
      setLoading(false)
      return
    }

    const parsedDestinations = destinations
      .filter(v => v !== '' && v !== null)
      .map(Number)

    if (parsedDestinations.length === 0) {
      setError('Please add at least one destination.')
      setLoading(false)
      return
    }
    if (parsedDestinations.some(v => !Number.isInteger(v) || v < 1)) {
      setError('Each destination must be a valid number greater than 0.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/routes/optimize-route/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        },
        body: JSON.stringify({
          start_location: startNum,
          destinations: parsedDestinations,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data?.detail || data?.error || 'Request failed.')
        setLoading(false)
        return
      }

      setResult(data)
      setError('')
      if (data.id) await fetchPathLocations(data.id)
    } catch (err) {
      setError('Network error. Please check backend server.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const stopColor = (i) => {
    if (i === 0) return '#16a34a'
    if (i === pathLocation.length - 1) return '#dc2626'
    return '#2563eb'
  }

  const getStopLabel = (i) => {
    if (i === 0) return 'Start'
    if (i === pathLocation.length - 1) return 'End'
    return `Stop ${i}`
  }

  // Valid destination numbers for the map (filter out empty strings)
  const validDestIDs = destinations.filter(v => v !== '' && Number(v) > 0).map(Number)

  return (
    <section id="center" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', gap: '12px', boxSizing: 'border-box' }}>

      {/* Top row: map + sidebar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Map — fixed size */}
        <div style={{
          width: '700px',
          height: '500px',
          flexShrink: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '0.5px solid #e0e0e0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <MapComponent
            locations={locations}
            path={pathLocation}
            startId={startLocation}
            destinationIDs={validDestIDs}
            onSelectLocation={handleSelectLocation}
          />
        </div>

        {/* Sidebar */}
        <div style={{
          flex: 1,
          height: '500px',
          // overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingRight: '4px',
        }}>

          {/* Start location */}
          <div>
            <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
              Start location
            </label>
            <input
              type="number"
              min="1"
              value={startLocation}
              placeholder="type or click map"
              onChange={(e) => handleStartLocationChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            {startLocation && (
              <p style={{ fontSize: '12px', color: '#16a34a', margin: '4px 0 0' }}>
                {locationMap[Number(startLocation)]?.name || '⚠ ID not found'}
              </p>
            )}
          </div>

          {/* Destinations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px',overflowY:'auto' }}>
            <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Destinations</p>

            {destinations.map((value, index) => (
              <div key={index}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={value}
                    placeholder={`destination ${index + 1}`}
                    onChange={(e) => handleDestinationChange(index, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    style={{ padding: '0 10px' }}
                  >
                    ✕
                  </button>
                </div>
                {value !== '' && (
                  <p style={{ fontSize: '12px', color: '#2563eb', margin: '2px 0 0' }}>
                    {locationMap[Number(value)]?.name || '⚠ ID not found'}
                  </p>
                )}
              </div>
            ))}

           
          </div>
            <button type="button" onClick={handleAdd} style={{ width: '100%', fontSize: '13px' }}>
              + Add destination
            </button>
          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', fontWeight: 500 }}>
            {loading ? 'Calculating...' : 'Calculate route'}
          </button>

          {error && (
            <p style={{ color: 'crimson', fontSize: '13px', margin: 0 }}>{error}</p>
          )}

          {result && (
            <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '13px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Result</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666' }}>Distance</span>
                <span>{totalDistance !== null ? `${totalDistance.toFixed(2)} km` : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#666' }}>Path</span>
                <span style={{ color: '#185FA5' }}>{result.path?.join(' → ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Time</span>
                <span>{result.execution_time}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '4px 2px' }}>
        {[
          { color: '#16a34a', label: 'Start' },
          { color: '#2563eb', label: 'Destination' },
          { color: '#dc2626', label: 'End' },
          { color: '#9ca3af', label: 'Other location' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* Stop cards */}
      {pathLocation.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {pathLocation.map((loc, i) => (
            <div key={`card-${i}`} style={{
              flexShrink: 0,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderLeft: `3px solid ${stopColor(i)}`,
              borderRadius: '8px',
              padding: '8px 12px',
              minWidth: '120px',
              maxWidth: '160px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: stopColor(i), marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {getStopLabel(i)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loc.name}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>ID {loc.id}</div>
            </div>
          ))}
        </div>
      )}

    </section>
  )
}

export default App