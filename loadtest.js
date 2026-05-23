import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  terminate,
} from 'firebase/firestore'
import { demos } from './src/data/demos.js'
import fs from 'node:fs'
import crypto from 'node:crypto'

const NUM_USERS = 100
const MIN_LIKES = 5
const MAX_LIKES = 10

function loadEnv() {
  let raw
  try {
    raw = fs.readFileSync('.env', 'utf-8')
  } catch {
    console.error('Could not read .env — make sure Firebase env vars are set in .env')
    process.exit(1)
  }
  const out = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}

const env = loadEnv()
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  console.error('VITE_FIREBASE_PROJECT_ID is missing in .env')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function resolveSessionId() {
  try {
    const snap = await getDoc(doc(db, 'session', 'current'))
    if (snap.exists() && snap.data().sessionId) {
      return { sessionId: snap.data().sessionId, source: 'live admin session' }
    }
  } catch (e) {
    console.warn('Could not read live session:', e.message)
  }
  return { sessionId: `loadtest_${Date.now().toString(36)}`, source: 'generated (no live session)' }
}

function pickLikes() {
  const count = MIN_LIKES + Math.floor(Math.random() * (MAX_LIKES - MIN_LIKES + 1))
  const pool = Array.from({ length: demos.length }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, demos.length))
}

async function simulateUser(sessionId) {
  const userId = crypto.randomUUID()
  const liked = pickLikes()
  const started = Date.now()
  const batch = writeBatch(db)
  for (const demoIndex of liked) {
    const ref = doc(db, 'likes', `${sessionId}_${userId}_${demoIndex}`)
    batch.set(ref, { userId, demoIndex, sessionId, timestamp: serverTimestamp() })
  }
  try {
    await batch.commit()
    return { userId, likedCount: liked.length, ms: Date.now() - started, success: true }
  } catch (e) {
    return { userId, likedCount: liked.length, ms: Date.now() - started, success: false, error: e.message }
  }
}

async function main() {
  const { sessionId, source } = await resolveSessionId()
  console.log(`Load test: ${NUM_USERS} concurrent users, ${MIN_LIKES}-${MAX_LIKES} likes each`)
  console.log(`Demos in list: ${demos.length}`)
  console.log(`Session: ${sessionId} (${source})`)
  console.log('---')

  const start = Date.now()
  const results = await Promise.all(
    Array.from({ length: NUM_USERS }, () => simulateUser(sessionId))
  )
  const elapsed = Date.now() - start

  let success = 0
  let failure = 0
  let totalWrites = 0
  const latencies = []
  for (const r of results) {
    const short = r.userId.slice(0, 8)
    if (r.success) {
      success++
      totalWrites += r.likedCount
      latencies.push(r.ms)
      console.log(`[OK]   ${short}  ${r.likedCount} likes  ${r.ms}ms`)
    } else {
      failure++
      console.log(`[FAIL] ${short}  ${r.likedCount} likes  ${r.ms}ms  ${r.error}`)
    }
  }

  latencies.sort((a, b) => a - b)
  const pct = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : 0

  console.log('---')
  console.log(`Total time:   ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`)
  console.log(`Users:        ${NUM_USERS}`)
  console.log(`Successes:    ${success}`)
  console.log(`Failures:     ${failure}`)
  console.log(`Total writes: ${totalWrites}`)
  console.log(`Throughput:   ${(totalWrites / (elapsed / 1000)).toFixed(1)} writes/sec`)
  if (latencies.length) {
    console.log(`Latency p50:  ${pct(0.5)}ms`)
    console.log(`Latency p95:  ${pct(0.95)}ms`)
    console.log(`Latency max:  ${latencies[latencies.length - 1]}ms`)
  }

  await terminate(db).catch(() => {})
  process.exit(failure > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
