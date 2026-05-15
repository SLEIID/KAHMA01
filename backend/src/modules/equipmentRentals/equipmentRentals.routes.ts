import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { getAllHandler, rentHandler, returnHandler, assignReportHandler } from './equipmentRentals.controller'

const router = Router()

router.use(authenticate)

router.get('/',              getAllHandler)       // pracownik: własne; admin: wszystkie
router.post('/',             rentHandler)         // wszyscy zalogowani (z can_rent_equipment)
router.patch('/:id/return',  returnHandler)       // właściciel lub admin
router.patch('/:id/report',  assignReportHandler) // właściciel lub admin — przypisz/odepnij raport

export default router
