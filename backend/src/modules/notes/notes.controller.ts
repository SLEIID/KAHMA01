import { Request, Response } from 'express'
import * as notesService from './notes.service'
import { createNoteSchema, updateNoteSchema, listNotesSchema } from './notes.schemas'

export async function listHandler(req: Request, res: Response) {
  const query = listNotesSchema.parse(req.query)
  const data  = await notesService.list(query, req.user!.id, req.user!.role)
  res.json({ success: true, data })
}

export async function createHandler(req: Request, res: Response) {
  const dto  = createNoteSchema.parse(req.body)
  const note = await notesService.create(req.user!.id, dto)
  res.status(201).json({ success: true, data: note })
}

export async function updateHandler(req: Request, res: Response) {
  const dto  = updateNoteSchema.parse(req.body)
  const note = await notesService.update(req.params.id, req.user!.id, req.user!.role, dto)
  res.json({ success: true, data: note })
}

export async function removeHandler(req: Request, res: Response) {
  await notesService.remove(req.params.id, req.user!.id, req.user!.role)
  res.json({ success: true })
}
