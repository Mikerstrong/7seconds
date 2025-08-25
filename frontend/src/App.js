import React, { useEffect, useState, useRef } from 'react'

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001'

function App() {
  const [timeLeft, setTimeLeft] = useState(7)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/health`).catch(() => {})
    fetchScore()
  }, [])

  const fetchScore = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/score`)
      const j = await res.json()
      setScore(j.score ?? 0)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            // award a point
            awardPoint()
            return 7
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const awardPoint = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment: 1 })
      })
      const j = await res.json()
      setScore(j.score ?? (score + 1))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: 40 }}>
      <h1>Welcome to 7seconds!</h1>
      <div style={{ fontSize: 48, margin: '20px 0' }}>{timeLeft}s</div>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Start'}</button>
        <button onClick={() => { setTimeLeft(7); setRunning(false) }} style={{ marginLeft: 8 }}>Reset</button>
      </div>
      <div style={{ fontSize: 20 }}>Points: {score}</div>
    </div>
  )
}

export default App
