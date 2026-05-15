import client from './client'

export interface Note {
  id:        string
  title:     string
  content:   string
  createdAt: string
  updatedAt: string
  user:      { id: string; fullName: string; login: string }
}

export interface NoteListResult {
  items: Note[]
  total: number
  page:  number
  limit: number
  pages: number
}

export const notesApi = {
  list: (params?: Record<string, string | number>) =>
    client.get<{ success: true; data: NoteListResult }>('/notes', { params }),

  create: (body: { title: string; content: string }) =>
    client.post<{ success: true; data: Note }>('/notes', body),

  update: (id: string, body: { title?: string; content?: string }) =>
    client.patch<{ success: true; data: Note }>(`/notes/${id}`, body),

  remove: (id: string) =>
    client.delete(`/notes/${id}`),
}
