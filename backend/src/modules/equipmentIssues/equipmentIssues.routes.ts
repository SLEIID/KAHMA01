import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import { getAllHandler, createHandler, updateHandler } from './equipmentIssues.controller'

const router = Router()

router.use(authenticate)

router.get('/',          getAllHandler)                       // pracownik: własne; admin: wszystkie
router.post('/',         createHandler)                      // wszyscy zalogowani
router.patch('/:id',     authorize('admin'), updateHandler)  // tylko admin (zmiana statusu)

export default router
