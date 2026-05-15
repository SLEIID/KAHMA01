import { prisma } from '../../lib/prisma'
import { ApiError } from '../../shared/ApiError'
import {
  CreateOrderDto, ListOrdersDto, UpdateStatusDto,
  AssignReportDto, AddItemDto, UpdateItemDto, PromoteItemDto,
} from './purchaseOrders.schemas'

type Requester = { id: string; role: string; canOrder: boolean; canPrepare: boolean }

function canManage(r: Requester) {
  return r.role === 'admin' || r.canOrder
}

function canPrepareOrder(r: Requester) {
  return r.role === 'admin' || r.canPrepare
}

const itemInclude = {
  material: { select: { id: true, name: true, catalogNumber: true } },
} as const

const orderInclude = {
  user:       { select: { id: true, fullName: true } },
  location:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  report:     { select: { id: true, reportDate: true } },
  items:      { include: itemInclude },
} as const

function validateItem(dto: { materialId?: number; customName?: string }) {
  if (!dto.materialId && !dto.customName) {
    throw ApiError.badRequest('Pozycja musi mieć materiał z katalogu lub opis ręczny')
  }
  if (dto.materialId && dto.customName) {
    throw ApiError.badRequest('Pozycja nie może mieć jednocześnie materiału z katalogu i opisu ręcznego')
  }
}

async function findOrder(id: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: orderInclude })
  if (!order) throw ApiError.notFound('Zamówienie nie istnieje')
  return order
}

function assertAccess(order: { userId: string }, r: Requester) {
  if (order.userId !== r.id && !canManage(r) && !canPrepareOrder(r)) throw ApiError.forbidden()
}

function assertEditable(order: { status: string }) {
  if (order.status !== 'pending') throw ApiError.badRequest('Można edytować tylko zamówienia w statusie "Oczekuje"')
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function list(r: Requester, dto: ListOrdersDto) {
  const where: Record<string, unknown> = {}

  if (!canManage(r) && !canPrepareOrder(r)) {
    where.userId = r.id
  } else if (dto.userId) {
    where.userId = dto.userId
  }

  if (dto.status)     where.status     = dto.status
  if (dto.locationId) where.locationId = dto.locationId
  if (dto.from || dto.to) {
    where.createdAt = {
      ...(dto.from ? { gte: new Date(dto.from) } : {}),
      ...(dto.to   ? { lte: new Date(dto.to + 'T23:59:59Z') } : {}),
    }
  }

  const skip = (dto.page - 1) * dto.limit
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: dto.limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  return { items, total, page: dto.page, limit: dto.limit }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function create(r: Requester, dto: CreateOrderDto) {
  dto.items.forEach(validateItem)

  return prisma.purchaseOrder.create({
    data: {
      userId:       r.id,
      locationId:   dto.locationId   ?? null,
      departmentId: dto.departmentId ?? null,
      neededBy:     dto.neededBy     ? new Date(dto.neededBy) : null,
      notes:        dto.notes        ?? null,
      items: {
        create: dto.items.map(i => ({
          materialId: i.materialId ?? null,
          customName: i.customName ?? null,
          quantity:   i.quantity,
          unit:       i.unit,
          notes:      i.notes ?? null,
        })),
      },
    },
    include: orderInclude,
  })
}

// ─── Get by id ────────────────────────────────────────────────────────────────

export async function getById(id: string, r: Requester) {
  const order = await findOrder(id)
  assertAccess(order, r)
  return order
}

// ─── Update status ────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:   ['ordered', 'cancelled'],
  ordered:   ['prepared', 'cancelled'],
  prepared:  ['delivered', 'cancelled'],
  delivered: ['cancelled'],
}

// Kto może wykonać dane przejście
function canTransition(r: Requester, from: string, to: string): boolean {
  if (r.role === 'admin') return true
  if (to === 'ordered')   return canManage(r)
  if (to === 'prepared')  return canPrepareOrder(r)
  if (to === 'delivered') return canManage(r)
  if (to === 'cancelled') return canManage(r) || canPrepareOrder(r)
  return false
}

export async function updateStatus(id: string, r: Requester, dto: UpdateStatusDto) {
  const order = await findOrder(id)
  const allowed = ALLOWED_TRANSITIONS[order.status] ?? []

  if (!allowed.includes(dto.status)) {
    throw ApiError.badRequest(`Przejście ${order.status} → ${dto.status} jest niedozwolone`)
  }

  if (!canTransition(r, order.status, dto.status)) {
    throw ApiError.forbidden()
  }

  return prisma.purchaseOrder.update({
    where:   { id },
    data:    { status: dto.status },
    include: orderInclude,
  })
}

// ─── Assign report ────────────────────────────────────────────────────────────

export async function assignReport(id: string, r: Requester, dto: AssignReportDto) {
  const order = await findOrder(id)
  assertAccess(order, r)
  if (order.status !== 'delivered') throw ApiError.badRequest('Raport można przypisać tylko do dostarczonego zamówienia')

  if (dto.reportId) {
    const report = await prisma.dailyReport.findUnique({ where: { id: dto.reportId } })
    if (!report) throw ApiError.notFound('Raport nie istnieje')
  }

  return prisma.purchaseOrder.update({
    where:   { id },
    data:    { reportId: dto.reportId },
    include: orderInclude,
  })
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancel(id: string, r: Requester) {
  const order = await findOrder(id)

  if (order.userId !== r.id && !canManage(r)) throw ApiError.forbidden()

  if (order.status === 'cancelled') throw ApiError.badRequest('Zamówienie jest już anulowane')
  if (order.userId === r.id && !canManage(r) && order.status !== 'pending') {
    throw ApiError.badRequest('Możesz anulować tylko zamówienie w statusie "Oczekuje"')
  }

  return prisma.purchaseOrder.update({
    where:   { id },
    data:    { status: 'cancelled' },
    include: orderInclude,
  })
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function addItem(orderId: string, r: Requester, dto: AddItemDto) {
  validateItem(dto)
  const order = await findOrder(orderId)
  assertAccess(order, r)
  assertEditable(order)

  return prisma.purchaseOrderItem.create({
    data: {
      orderId,
      materialId: dto.materialId ?? null,
      customName: dto.customName ?? null,
      quantity:   dto.quantity,
      unit:       dto.unit,
      notes:      dto.notes ?? null,
    },
    include: itemInclude,
  })
}

export async function updateItem(orderId: string, itemId: string, r: Requester, dto: UpdateItemDto) {
  const order = await findOrder(orderId)
  assertAccess(order, r)
  assertEditable(order)

  const item = await prisma.purchaseOrderItem.findFirst({ where: { id: itemId, orderId } })
  if (!item) throw ApiError.notFound('Pozycja nie istnieje')

  return prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.unit     !== undefined ? { unit: dto.unit }         : {}),
      ...(dto.notes    !== undefined ? { notes: dto.notes }       : {}),
    },
    include: itemInclude,
  })
}

export async function deleteItem(orderId: string, itemId: string, r: Requester) {
  const order = await findOrder(orderId)
  assertAccess(order, r)
  assertEditable(order)

  const item = await prisma.purchaseOrderItem.findFirst({ where: { id: itemId, orderId } })
  if (!item) throw ApiError.notFound('Pozycja nie istnieje')

  if (order.items.length <= 1) throw ApiError.badRequest('Zamówienie musi mieć co najmniej jedną pozycję')

  await prisma.purchaseOrderItem.delete({ where: { id: itemId } })
}

// ─── Promote item to catalog ──────────────────────────────────────────────────

export async function promoteItem(orderId: string, itemId: string, r: Requester, dto: PromoteItemDto) {
  if (!canManage(r)) throw ApiError.forbidden()

  const order = await findOrder(orderId)
  const item  = await prisma.purchaseOrderItem.findFirst({ where: { id: itemId, orderId } })
  if (!item) throw ApiError.notFound('Pozycja nie istnieje')
  if (!item.customName) throw ApiError.badRequest('Pozycja jest już powiązana z materiałem z katalogu')

  const material = await prisma.material.create({
    data: {
      name:          dto.name,
      catalogNumber: dto.catalogNumber ?? null,
    },
  })

  const updated = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data:  { materialId: material.id, customName: null },
    include: itemInclude,
  })

  return { material, item: updated }
}
