import { useEffect, useState, useCallback } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { db, isConfigured, sessionDoc } from '../firebase'
import { demos } from '../data/demos'

const STORAGE_KEY = 'demo-helper:reactions'

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
        if (!snap.exists()) setIndex(-1)
        else setIndex(snap.data().index ?? -1)
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

  const toggle = (kind) => {
    if (!current) return
    const currentReaction = reactions[current.id]?.reaction
    updateReaction(current.id, { reaction: currentReaction === kind ? null : kind })
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
            onClick={() => toggle('pass')}
          >
            Pass
          </button>
          <button
            className={`btn btn-like ${reaction?.reaction === 'like' ? 'active' : ''}`}
            onClick={() => toggle('like')}
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

  return (
    <div className="shell">
      <h1 className="h1">Your picks</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
        {liked.length === 0
          ? 'You didn’t like any demos.'
          : `${liked.length} demo${liked.length === 1 ? '' : 's'} you want to remember.`}
      </p>

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
    </div>
  )
}
