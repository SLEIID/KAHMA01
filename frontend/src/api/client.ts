import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Dołącz token do każdego żądania
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

// Auto-refresh przy 401
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return client(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
      const { accessToken, user } = data.data
      useAuthStore.getState().setAuth(accessToken, user)
      processQueue(null, accessToken)
      original.headers.Authorization = `Bearer ${accessToken}`
      return client(original)
    } catch (err) {
      processQueue(err, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)

export default client
