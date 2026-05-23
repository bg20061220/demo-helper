import { Routes, Route } from 'react-router-dom'
import Viewer from './pages/Viewer'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Viewer />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
