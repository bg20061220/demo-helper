import { useEffect, useState, useMemo } from 'react'
import { onSnapshot, setDoc, collection, query, where } from 'firebase/firestore'
import { db, isConfigured, sessionDoc } from '../firebase'
import { demos } from '../data/demos'

const PASSWORD = 'monte@1098'
const AUTH_KEY = 'demo-helper:admin'

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (pw === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1')
      setUnlocked(true)
    } else {
      setError('Wrong password')
    }
  }

  if (!unlocked) {
    return (
      <div className="shell">
        <div className="center" style={{ width: '100%' }}>
          <form onSubmit={submit} style={{ width: '100%', maxWidth: 360 }}>
            <h1 className="h1">Admin</h1>
            <input
              type="password"
              className="password"
              placeholder="Password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError('') }}
              autoFocus
            />
            {error && <div className="muted" style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}
            <button type="submit" className="btn btn-like active" style={{ marginTop: 16, width: '100%' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <AdminPanel />
}

function AdminPanel() {
  const [index, setIndex] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [likeCounts, setLikeCounts] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isConfigured) {
      setError('Firebase is not configured. Copy .env.example to .env and fill in your project credentials.')
      return
    }
    const unsub = onSnapshot(
      sessionDoc(),
      (snap) => {
        if (!snap.exists()) {
          setIndex(-1)
          setSessionId(null)
          return
        }
        const data = snap.data()
        setIndex(data.index ?? -1)
        setSessionId(data.sessionId ?? null)
      },
      (err) => setError(err.message)
    )
    return unsub
  }, [])

  useEffect(() => {
    if (!isConfigured || !sessionId) {
      setLikeCounts({})
      return
    }
    const q = query(collection(db, 'likes'), where('sessionId', '==', sessionId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const counts = {}
        snap.forEach((d) => {
          const { demoIndex } = d.data()
          counts[demoIndex] = (counts[demoIndex] || 0) + 1
        })
        setLikeCounts(counts)
      },
      (err) => setError(err.message)
    )
    return unsub
  }, [sessionId])

  const leaderboard = useMemo(() => {
    return demos
      .map((d, i) => ({ demoIndex: i, demo: d, count: likeCounts[i] || 0 }))
      .sort((a, b) => b.count - a.count || a.demoIndex - b.demoIndex)
  }, [likeCounts])

  const advance = async (next) => {
    try {
      await setDoc(sessionDoc(), { index: next }, { merge: true })
    } catch (e) {
      setError(e.message)
    }
  }

  const startFresh = async (next) => {
    try {
      const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await setDoc(sessionDoc(), { index: next, sessionId })
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) {
    return (
      <div className="shell">
        <div className="center">
          <div>
            <h1 className="h1">Setup needed</h1>
            <p className="muted">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (index == null) {
    return <div className="shell"><div className="center muted">Connecting…</div></div>
  }

  const current = index >= 0 && index < demos.length ? demos[index] : null
  const atEnd = index >= demos.length
  const notStarted = index === -1

  return (
    <div className="shell">
      <div className="progress">
        {notStarted ? 'Session not started' : atEnd ? 'Session complete' : `Showing ${index + 1} of ${demos.length}`}
      </div>

      <div className="card">
        {notStarted && (
          <>
            <div className="h1">Ready to begin?</div>
            <p className="muted">Tap Start to push the first demo to viewers.</p>
            <button className="btn btn-like active" style={{ width: '100%', marginTop: 16 }} onClick={() => startFresh(0)}>
              Start session
            </button>
          </>
        )}

        {current && (
          <>
            <div className="company">{current.company}</div>
            <div className="name">{current.name}</div>
            <div className="oneLiner">{current.oneLiner}</div>
            <div className="admin-controls">
              <button className="btn btn-pass" onClick={() => advance(index - 1)} disabled={index === 0}>
                ← Prev
              </button>
              <button className="btn btn-like active" onClick={() => advance(index + 1)}>
                {index === demos.length - 1 ? 'Finish →' : 'Next →'}
              </button>
            </div>
          </>
        )}

        {atEnd && (
          <>
            <div className="h1">All done</div>
            <p className="muted">Viewers are now seeing their results screen.</p>
            <div className="admin-controls">
              <button className="btn btn-pass" onClick={() => advance(demos.length - 1)}>
                ← Back to last
              </button>
              <button className="btn btn-like active" onClick={() => startFresh(-1)}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2" style={{ marginBottom: 12 }}>Leaderboard</div>
        {!sessionId ? (
          <p className="muted" style={{ margin: 0 }}>Start a session to begin collecting likes.</p>
        ) : leaderboard.every((r) => r.count === 0) ? (
          <p className="muted" style={{ margin: 0 }}>No likes yet — viewers submit when they reach the results screen.</p>
        ) : (
          <div className="leaderboard">
            {leaderboard.filter((r) => r.count > 0).map((row, i) => (
              <div key={row.demoIndex} className="leaderboard-row">
                <span className="lb-rank">#{i + 1}</span>
                <span className="lb-info">
                  <span className="lb-company">{row.demo.company}</span>
                  <span className="lb-name muted">{row.demo.name}</span>
                </span>
                <span className="lb-count">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
