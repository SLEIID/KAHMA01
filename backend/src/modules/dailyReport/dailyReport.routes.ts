import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import {
  listHandler, getByIdHandler, createHandler,
  addEntryHandler, updateEntryHandler, deleteEntryHandler,
  exportHandler, approveHandler, unlockHandler,
  signOntoHandler, signOffHandler, availableToSignHandler,
  deleteReportHandler,
} from './dailyReport.controller'

const router = Router()

router.use(authenticate)

// Stałe ścieżki przed parametryczną /:id
router.get('/export',              exportHandler)
router.get('/available-to-sign',   availableToSignHandler)
router.patch('/entries/:entryId',  updateEntryHandler)
router.delete('/entries/:entryId', deleteEntryHandler)

router.get('/',                     listHandler)
router.get('/:id',                  getByIdHandler)
router.post('/',                    createHandler)
router.post('/:reportId/entries',   addEntryHandler)
router.patch('/:id/approve',        approveHandler)
router.post('/:id/unlock',          unlockHandler)
router.post('/:id/sign',            signOntoHandler)
router.delete('/:id/sign',          signOffHandler)
router.delete('/:id',               deleteReportHandler)

export default router
