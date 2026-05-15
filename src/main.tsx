import { createRoot } from 'react-dom/client'

function App() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e0e0e0',
      fontFamily: 'sans-serif',
      fontSize: '1.5rem',
    }}>
      3D Viewer Loading...
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
