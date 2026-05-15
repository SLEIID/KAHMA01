import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authorize } from '../../middleware/authorize'
import {
  getCategoriesHandler,
  getItemsHandler,
  createCategoryHandler,
  createItemHandler,
  updateItemHandler,
  deleteItemHandler,
} from './equipment.controller'

const router = Router()

router.use(authenticate)

router.get('/categories', getCategoriesHandler)                          // wszyscy
router.get('/items',      getItemsHandler)                               // wszyscy (role filtruje)

router.post('/categories',    authorize('admin'), createCategoryHandler) // admin
router.post('/items',          authorize('admin'), createItemHandler)    // admin
router.patch('/items/:id',    authorize('admin'), updateItemHandler)     // admin
router.delete('/items/:id',   authorize('admin'), deleteItemHandler)     // admin

export default router
