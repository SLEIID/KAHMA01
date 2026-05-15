import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller'
import { authenticate } from '../../middleware/auth'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Zbyt wiele prób logowania. Spróbuj za 15 minut.' },
})

router.post('/login', authLimiter, loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', logoutHandler)
router.get('/me', authenticate, meHandler)

export default router
