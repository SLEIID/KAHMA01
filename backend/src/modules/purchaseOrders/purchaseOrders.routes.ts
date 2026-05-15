import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './purchaseOrders.controller'

const router = Router()
router.use(authenticate)

// Zamówienia
router.get('/',    ctrl.listHandler)
router.post('/',   ctrl.createHandler)
router.get('/:id', ctrl.getByIdHandler)

router.patch('/:id/status', ctrl.updateStatusHandler)
router.patch('/:id/report', ctrl.assignReportHandler)
router.patch('/:id/cancel', ctrl.cancelHandler)

// Pozycje
router.post('/:orderId/items',                   ctrl.addItemHandler)
router.patch('/:orderId/items/:itemId',           ctrl.updateItemHandler)
router.delete('/:orderId/items/:itemId',          ctrl.deleteItemHandler)
router.post('/:orderId/items/:itemId/promote',    ctrl.promoteItemHandler)

export default router
