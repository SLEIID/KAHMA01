import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(145deg, #18181b 0%, #1f1f23 50%, #27272a 100%)',
      }}
    >
      {/* Siatka punktów — subtelna głębia */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow górny lewy */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }}
      />

      {/* Glow dolny prawy */}
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
