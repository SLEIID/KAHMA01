import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import * as svc from './materials.service'
import { searchSchema, createMaterialSchema, updateMaterialSchema, bulkCreateSchema } from './materials.schemas'
import { ok, created } from '../../shared/response'
import { ApiError } from '../../shared/ApiError'

export async function searchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = searchSchema.parse(req.query)
    ok(res, await svc.search(q, req.user!.id))
  } catch (err) { next(err) }
}

export async function getAllHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getAll())
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createMaterialSchema.parse(req.body)
    created(res, await svc.create(dto))
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id  = parseInt(req.params.id, 10)
    const dto = updateMaterialSchema.parse(req.body)
    ok(res, await svc.update(id, dto))
  } catch (err) { next(err) }
}

export async function bulkCreateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = bulkCreateSchema.parse(req.body)
    ok(res, await svc.bulkCreate(dto))
  } catch (err) { next(err) }
}

export async function photoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filename = req.params.filename
    // Zabezpieczenie przed path traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw ApiError.badRequest('Nieprawidłowa nazwa pliku')
    }
    const filePath = path.join(process.cwd(), 'uploads', 'materials', filename)
    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('Plik nie istnieje')
    }
    res.sendFile(filePath)
  } catch (err) { next(err) }
}
