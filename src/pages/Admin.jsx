import { useEffect, useState } from 'react'
import { onSnapshot, setDoc } from 'firebase/firestore'
import { isConfigured, sessionDoc } from '../firebase'
import { demos } from '../data/demos'

const PASSWORD = 'admin123'
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
            <button type="submit" className="btn btn-like" style={{ marginTop: 16, width: '100%' }}>
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
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isConfigured) {
      setError('Firebase is not configured. Copy .env.example to .env and fill in your project credentials.')
      return
    }
    const unsub = onSnapshot(
      sessionDoc(),
      (snap) => setIndex(!snap.exists() ? -1 : (snap.data().index ?? -1)),
      (err) => setError(err.message)
    )
    return unsub
  }, [])

  const setTo = async (next) => {
    try {
      await setDoc(sessionDoc(), { index: next })
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
            <button className="btn btn-like" style={{ width: '100%', marginTop: 16 }} onClick={() => setTo(0)}>
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
              <button className="btn btn-pass" onClick={() => setTo(index - 1)} disabled={index === 0}>
                ← Prev
              </button>
              <button className="btn btn-like" onClick={() => setTo(index + 1)}>
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
              <button className="btn btn-pass" onClick={() => setTo(demos.length - 1)}>
                ← Back to last
              </button>
              <button className="btn btn-like" onClick={() => setTo(-1)}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
