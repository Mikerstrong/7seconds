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
      console.log('Fetching users from:', `${API_BASE}/api/users`)
      const res = await fetch(`${API_BASE}/api/users`, { 
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Users response status:', res.status)
      
      if (!res.ok) {
        console.error('Error response:', res.status, res.statusText)
        setUsers([])
        return
      }
      
      // Get response as text first for debugging
      const text = await res.text()
      console.log('Raw response:', text)
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(text)
        console.log('Parsed users data:', data)
        
        if (data && Array.isArray(data.users)) {
          console.log('Setting users:', data.users)
          setUsers(data.users)
        } else {
          console.error('Invalid users format, expected array:', data)
          setUsers([])
        }
      } catch (e) {
        console.error('Failed to parse users JSON:', e)
        setUsers([])
      }
    } catch (e) {
      console.error('Error fetching users:', e)
      setUsers([])
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
    if (!newUsername || newUsername.length < 2) {
      alert('Username must be at least 2 characters')
      return
    }
    
    try {
      console.log('Creating user with username:', newUsername)
      
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json' 
        },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername })
      })
      
      console.log('Create user response status:', res.status)
      
      // Get response as text first for debugging
      const text = await res.text()
      console.log('Raw create response:', text)
      
      if (res.ok) {
        try {
          const user = JSON.parse(text)
          console.log('User created successfully:', user)
          
          // Clear the input
          setNewUsername('')
          
          // Force refetch of users list
          await fetchUsers()
          
          // Add a small delay for UI update
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Refresh users list again and select new user
          await fetchUsers()
          
          // Check if the user was created properly
          if (user && user.id) {
            console.log('Selecting newly created user:', user.id)
            await selectUser(user.id)
          }
        } catch (e) {
          console.error('Failed to parse create user response:', e)
        }
      } else {
        console.error('Failed to create user:', text)
        alert('Failed to create user: ' + (text || 'Unknown error'))
      }
    } catch (e) {
      console.error('Error in createUser:', e)
      alert('Error creating user: ' + e.message)
    }
  }
  
  const selectUser = async (userId) => {
    if (!userId) {
      console.error('Cannot select user: No userId provided')
      return
    }
    
    try {
      console.log('Selecting user with ID:', userId)
      const res = await fetch(`${API_BASE}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId })
      })
      
      if (res.ok) {
        const user = await res.json()
        console.log('User selected:', user)
        
        // Update local state with selected user
        setCurrentUser(user)
        
        // Refresh points for the selected user
        await fetchPoints()
      } else {
        const error = await res.json()
        console.error('Failed to select user:', error)
      }
    } catch (e) {
      console.error('Error in selectUser:', e)
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
            style={{ padding: '8px', marginRight: '10px', minWidth: '200px' }}
          >
            <option value="" disabled>Select a user</option>
            {users && users.length > 0 ? (
              users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))
            ) : (
              <option value="" disabled>No users available</option>
            )}
          </select>
          <button 
            onClick={fetchUsers}
            style={{ padding: '8px 16px', marginLeft: '10px' }}
          >
            Refresh Users
          </button>
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
