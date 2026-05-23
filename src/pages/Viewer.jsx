import { useEffect, useState, useCallback } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { db, isConfigured, sessionDoc } from '../firebase'
import { demos } from '../data/demos'

const STORAGE_KEY = 'demo-helper:reactions'
const SESSION_KEY = 'demo-helper:sessionId'

function loadReactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveReactions(r) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r))
}

export default function Viewer() {
  const [index, setIndex] = useState(null)
  const [reactions, setReactions] = useState(loadReactions)
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
          return
        }
        const data = snap.data()
        const remoteSessionId = data.sessionId
        if (remoteSessionId && remoteSessionId !== localStorage.getItem(SESSION_KEY)) {
          localStorage.setItem(SESSION_KEY, remoteSessionId)
          localStorage.removeItem(STORAGE_KEY)
          setReactions({})
        }
        setIndex(data.index ?? -1)
      },
      (err) => setError(err.message)
    )
    return unsub
  }, [])

  const current = index != null && index >= 0 && index < demos.length ? demos[index] : null
  const reaction = current ? reactions[current.id] : null

  const updateReaction = useCallback((demoId, patch) => {
    setReactions((prev) => {
      const next = { ...prev, [demoId]: { ...(prev[demoId] || {}), ...patch } }
      saveReactions(next)
      return next
    })
  }, [])

  const setReaction = (kind) => {
    if (!current) return
    updateReaction(current.id, { reaction: kind })
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
    return (
      <div className="shell">
        <div className="center muted">Connecting…</div>
      </div>
    )
  }

  if (index === -1) {
    return (
      <div className="shell">
        <div className="center">
          <div>
            <h1 className="h1">Waiting to start</h1>
            <p className="muted">The session hasn’t kicked off yet. Hang tight.</p>
          </div>
        </div>
      </div>
    )
  }

  if (index >= demos.length) {
    return <Results reactions={reactions} />
  }

  return (
    <div className="shell">
      <div className="progress">Demo {index + 1} of {demos.length}</div>
      <div className="card">
        <div className="company">{current.company}</div>
        <div className="name">{current.name}</div>
        <div className="oneLiner">{current.oneLiner}</div>

        <div className="actions">
          <button
            className={`btn btn-pass ${reaction?.reaction === 'pass' ? 'active' : ''}`}
            onClick={() => setReaction('pass')}
          >
            Pass
          </button>
          <button
            className={`btn btn-like ${reaction?.reaction === 'like' ? 'active' : ''}`}
            onClick={() => setReaction('like')}
          >
            Like
          </button>
        </div>

        <textarea
          className="note"
          placeholder="Notes (only saved on your device)…"
          value={reaction?.note || ''}
          onChange={(e) => updateReaction(current.id, { note: e.target.value })}
        />
      </div>
    </div>
  )
}

function Results({ reactions }) {
  const liked = demos.filter((d) => reactions[d.id]?.reaction === 'like')
  const noted = demos.filter((d) => {
    const r = reactions[d.id]
    return r?.note?.trim() && r.reaction !== 'like'
  })

  const empty = liked.length === 0 && noted.length === 0

  return (
    <div className="shell">
      <h1 className="h1">Your picks</h1>
      {empty && (
        <p className="muted" style={{ marginTop: 0 }}>
          You didn’t like or take notes on any demos.
        </p>
      )}

      {liked.length > 0 && (
        <>
          <div className="section-title">Your likes ({liked.length})</div>
          <div className="results-list">
            {liked.map((d) => (
              <div key={d.id} className="result-item">
                <div className="company">{d.company}</div>
                <div className="h2" style={{ marginTop: 4 }}>{d.name}</div>
                <div className="muted" style={{ marginTop: 4 }}>{d.oneLiner}</div>
                {reactions[d.id]?.note && (
                  <div className="result-note">“{reactions[d.id].note}”</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {noted.length > 0 && (
        <>
          <div className="section-title">Your notes ({noted.length})</div>
          <div className="results-list">
            {noted.map((d) => (
              <div key={d.id} className="result-item">
                <div className="company">{d.company}</div>
                <div className="h2" style={{ marginTop: 4 }}>{d.name}</div>
                <div className="muted" style={{ marginTop: 4 }}>{d.oneLiner}</div>
                <div className="result-note">“{reactions[d.id].note}”</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
