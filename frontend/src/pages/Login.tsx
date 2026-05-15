import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/lib/theme'

const schema = z.object({
  login:    z.string().min(4, 'Min. 4 znaki'),
  password: z.string().min(4, 'Min. 4 znaki'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const t = useTheme()

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const loginReg    = register('login')
  const passwordReg = register('password')

  const loginMutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data),
    onSuccess: ({ data }) => {
      setAuth(data.data.accessToken, data.data.user)
      navigate('/')
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Błąd połączenia'
        : 'Błąd połączenia z serwerem'
      setError('root', { message })
    },
  })

  // Tło inputu — ciemniejsze od karty
  const inputBg  = t.dark ? '#374151' : '#dce8f8'
  const inputClr = t.dark ? '#f9fafb' : '#0c1e3c'
  const shadowIdle  = t.dark
    ? '0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 3px rgba(0,0,0,0.25)'
    : '0 0 0 1px rgba(12,30,60,0.12), inset 0 1px 3px rgba(12,30,60,0.08)'
  const shadowFocus = t.dark
    ? '0 0 0 3px rgba(251,191,36,0.30), inset 0 1px 2px rgba(0,0,0,0.15)'
    : '0 0 0 3px rgba(39,97,235,0.35), inset 0 1px 2px rgba(12,30,60,0.06)'
  const shadowError = t.dark
    ? '0 0 0 2.5px rgba(244,63,94,0.45), inset 0 1px 3px rgba(0,0,0,0.20)'
    : '0 0 0 2.5px rgba(244,63,94,0.40), inset 0 1px 3px rgba(12,30,60,0.08)'

  const inputBase: React.CSSProperties = {
    background: inputBg,
    color: inputClr,
    borderRadius: '0.75rem',
    width: '100%',
    padding: '0.75rem 1rem',
    outline: 'none',
    transition: 'box-shadow 0.15s ease',
    fontSize: '16px',
    boxShadow: shadowIdle,
  }

  return (
    <div className="animate-fade-in">

      {/* ── Logo ─────────────────────────────────── */}
      <div className="mb-7 flex flex-col items-center gap-4">
        <div className="relative">
          <img
            src="/logo.png"
            alt="Kahma"
            style={{
              width: 360,
              height: 'auto',
            }}
          />
        </div>
      </div>

      {/* ── Karta logowania ──────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: t.dark ? '#1f2937' : '#edf3fc',
          boxShadow: t.dark
            ? '0 8px 48px rgba(0,0,0,0.50), 0 2px 12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08)'
            : '0 8px 48px rgba(6,15,32,0.32), 0 2px 12px rgba(39,97,235,0.12), 0 0 0 1px rgba(255,255,255,0.12)',
        }}
      >
        <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">

          {/* Login */}
          <div className="space-y-1.5">
            <label
              className="block text-[13px] font-semibold"
              style={{ color: t.dark ? '#9ca3af' : '#1a4280' }}
            >
              Login
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="Wpisz swój login"
              style={{
                ...inputBase,
                ...(errors.login ? { boxShadow: shadowError } : {}),
              }}
              onFocus={(e) => {
                if (!errors.login) e.currentTarget.style.boxShadow = shadowFocus
              }}
              {...loginReg}
              onBlur={(e) => {
                loginReg.onBlur(e)
                if (!errors.login) e.currentTarget.style.boxShadow = shadowIdle
              }}
            />
            {errors.login && <p className="text-[12px] font-medium text-rose-500">{errors.login.message}</p>}
          </div>

          {/* Hasło */}
          <div className="space-y-1.5">
            <label
              className="block text-[13px] font-semibold"
              style={{ color: t.dark ? '#9ca3af' : '#1a4280' }}
            >
              Hasło
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Wpisz swoje hasło"
                style={{
                  ...inputBase,
                  paddingRight: '3rem',
                  ...(errors.password ? { boxShadow: shadowError } : {}),
                }}
                onFocus={(e) => {
                  if (!errors.password) e.currentTarget.style.boxShadow = shadowFocus
                }}
                {...passwordReg}
                onBlur={(e) => {
                  passwordReg.onBlur(e)
                  if (!errors.password) e.currentTarget.style.boxShadow = shadowIdle
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                style={{ color: t.dark ? '#6b7280' : '#5b8ff5' }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[12px] font-medium text-rose-500">{errors.password.message}</p>}
          </div>

          {/* Błąd */}
          {errors.root && (
            <div
              className="rounded-xl px-4 py-3 text-[13px] font-medium"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.22)',
                color: t.dark ? '#f87171' : '#be123c',
              }}
            >
              {errors.root.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full mt-1 rounded-xl py-3 flex items-center justify-center gap-2 text-[15px] font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
            style={t.dark ? {
              background: 'linear-gradient(160deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%)',
              color: '#1c1400',
              boxShadow: '0 4px 20px rgba(251,191,36,0.40), 0 1px 3px rgba(251,191,36,0.30), 0 0 0 1px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
            } : {
              background: 'linear-gradient(160deg, #3b7ef8 0%, #2761eb 50%, #1d4ed8 100%)',
              color: '#f0f6ff',
              boxShadow: '0 4px 20px rgba(39,97,235,0.40), 0 1px 3px rgba(39,97,235,0.30), 0 0 0 1px rgba(39,97,235,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {loginMutation.isPending ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                Zaloguj się
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-[12px]" style={{ color: t.dark ? '#6b7280' : '#2255a8' }}>
        Nie masz konta? Skontaktuj się z administratorem.
      </p>
    </div>
  )
}
