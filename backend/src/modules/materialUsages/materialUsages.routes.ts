import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { createHandler, listHandler, removeHandler, updateHandler, monthlySummaryHandler, exportMonthlyHandler, exportFilteredHandler } from './materialUsages.controller'

const router = Router()

router.use(authenticate)

router.get('/monthly-summary', monthlySummaryHandler)
router.get('/monthly-export',  exportMonthlyHandler)
router.get('/export',          exportFilteredHandler)
router.get('/',     listHandler)
router.post('/',    createHandler)
router.patch('/:id',  updateHandler)
router.delete('/:id', removeHandler)

export default router
