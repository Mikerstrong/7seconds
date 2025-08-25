import React, { useEffect, useState, useRef } from 'react'

// If REACT_APP_API_BASE is a relative URL (e.g. /api), use current origin
// Otherwise use the full URL provided in environment
const getApiBase = () => {
  const configuredBase = process.env.REACT_APP_API_BASE || 'http://localhost:3001'
  if (configuredBase.startsWith('/')) {
    return `${window.location.origin}${configuredBase}`
  }
  return configuredBase
}
const API_BASE = getApiBase()

function App() {
  const [timeLeft, setTimeLeft] = useState(7)
  const [points, setPoints] = useState(0)
  const [actionPoints, setActionPoints] = useState(0)
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [newUsername, setNewUsername] = useState('')
  const intervalRef = useRef(null)

  // Auto-start timer
  useEffect(() => {
    startTimer()
    
    // Fetch initial data
    fetchHealth()
    fetchUsers()
    fetchCurrentUser()
    fetchPoints()
    
    // Set up interval to fetch points regularly
    const pointsInterval = setInterval(fetchPoints, 5000)
    
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(pointsInterval)
    }
  }, [])
  
  const fetchHealth = async () => {
    try {
      await fetch(`${API_BASE}/api/health`, { credentials: 'include' })
    } catch (e) {
      console.error(e)
    }
  }
  
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { credentials: 'include' })
      const data = await res.json()
      setUsers(data.users || [])
    } catch (e) {
      console.error(e)
    }
  }
  
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session`, { credentials: 'include' })
      const user = await res.json()
      setCurrentUser(user)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchPoints = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/points`, { credentials: 'include' })
      const data = await res.json()
      setPoints(data.points ?? 0)
      setActionPoints(data.action_points ?? 0)
    } catch (e) {
      console.error(e)
    }
  }

  // Start the timer automatically
  const startTimer = () => {
    if (intervalRef.current) return
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          // Award a point when timer reaches 0
          awardPoint()
          return 7
        }
        return t - 1
      })
    }, 1000)
  }
  
  const createUser = async () => {
    if (!newUsername || newUsername.length < 2) return
    
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername })
      })
      
      if (res.ok) {
        const user = await res.json()
        setUsers([...users, user])
        setNewUsername('')
        selectUser(user.id)
      }
    } catch (e) {
      console.error(e)
    }
  }
  
  const selectUser = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId })
      })
      
      if (res.ok) {
        const user = await res.json()
        setCurrentUser(user)
        fetchPoints()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const awardPoint = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ increment: 1 })
      })
      
      const data = await res.json()
      setPoints(data.points)
      setActionPoints(data.action_points)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: 40 }}>
      <h1>Welcome to 7seconds!</h1>
      
      {/* User selection */}
      <div style={{ marginBottom: 20 }}>
        <h3>Current User: {currentUser?.username || 'default'}</h3>
        
        <div style={{ margin: '20px 0' }}>
          <select 
            value={currentUser?.id || ''}
            onChange={(e) => selectUser(Number(e.target.value))}
            style={{ padding: '8px', marginRight: '10px' }}
          >
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
        
        <div style={{ margin: '20px 0' }}>
          <input
            type="text"
            placeholder="New username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            style={{ padding: '8px', marginRight: '10px' }}
          />
          <button 
            onClick={createUser}
            style={{ padding: '8px 16px' }}
          >
            Add User
          </button>
        </div>
      </div>
      
      {/* Timer */}
      <div style={{ 
        fontSize: 70,
        margin: '20px 0',
        fontWeight: 'bold',
        color: timeLeft <= 2 ? '#cc0000' : 'black'
      }}>
        {timeLeft}s
      </div>
      
      {/* Points display */}
      <div style={{ 
        fontSize: 24,
        margin: '20px auto',
        display: 'flex',
        justifyContent: 'center',
        gap: '40px'
      }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>Points:</span> {points}
        </div>
        <div>
          <span style={{ fontWeight: 'bold' }}>Action Points:</span> {actionPoints}
        </div>
      </div>
      
      <div style={{ fontSize: 14, marginTop: 30, color: '#666' }}>
        Points automatically convert to Action Points every minute
      </div>
    </div>
  )
}

export default App
