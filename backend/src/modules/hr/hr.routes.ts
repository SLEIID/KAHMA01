import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize }    from '../../middleware/authorize'
import * as ctrl from './hr.controller'

const router = Router()
router.use(authenticate)

router.get('/leave-types',            ctrl.getLeaveTypes)
router.get('/balances/me',            ctrl.getMyBalance)
router.get('/balances',               authorize('admin'), ctrl.getAllBalances)
router.patch('/balances/:userId',     authorize('admin'), ctrl.updateBalance)
router.get('/requests',               ctrl.getRequests)
router.post('/requests',              ctrl.createRequest)
router.patch('/requests/:id/review',  authorize('admin'), ctrl.reviewRequest)
router.delete('/requests/:id',        ctrl.cancelRequest)
router.get('/attendance/export',      authorize('admin'), ctrl.exportAttendance)
router.get('/attendance',             authorize('admin'), ctrl.getAttendance)
router.get('/calendar',               ctrl.getCalendar)

export default router
