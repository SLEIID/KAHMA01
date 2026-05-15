import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import authRoutes             from './modules/auth/auth.routes'
import usersRoutes            from './modules/users/users.routes'
import vehiclesRoutes         from './modules/vehicles/vehicles.routes'
import dailyReportRoutes      from './modules/dailyReport/dailyReport.routes'
import equipmentRoutes        from './modules/equipment/equipment.routes'
import equipmentRentalsRoutes from './modules/equipmentRentals/equipmentRentals.routes'
import equipmentIssuesRoutes  from './modules/equipmentIssues/equipmentIssues.routes'
import materialsRoutes      from './modules/materials/materials.routes'
import materialUsagesRoutes from './modules/materialUsages/materialUsages.routes'
import materialAlertsRoutes from './modules/materialAlerts/materialAlerts.routes'
import locationsRoutes      from './modules/locations/locations.routes'
import departmentsRoutes    from './modules/departments/departments.routes'
import notesRoutes          from './modules/notes/notes.routes'
import hrRoutes             from './modules/hr/hr.routes'
import purchaseOrdersRoutes  from './modules/purchaseOrders/purchaseOrders.routes'
import contractorsRoutes     from './modules/contractors/contractors.routes'

const app = express()

// Trust proxy (Nginx reverse proxy)
app.set('trust proxy', 1)

// Security & parsing
app.use(helmet())
app.use(cors({
  origin: env.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

if (env.nodeEnv !== 'production') {
  app.use(morgan('dev'))
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kahma-api', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/v1/auth',               authRoutes)
app.use('/api/v1/users',              usersRoutes)
app.use('/api/v1/vehicles',           vehiclesRoutes)
app.use('/api/v1/daily-reports',      dailyReportRoutes)
app.use('/api/v1/equipment',          equipmentRoutes)
app.use('/api/v1/equipment-rentals',  equipmentRentalsRoutes)
app.use('/api/v1/equipment-issues',   equipmentIssuesRoutes)
app.use('/api/v1/materials',        materialsRoutes)
app.use('/api/v1/material-usages',  materialUsagesRoutes)
app.use('/api/v1/material-alerts',  materialAlertsRoutes)
app.use('/api/v1/locations',        locationsRoutes)
app.use('/api/v1/departments',      departmentsRoutes)
app.use('/api/v1/notes',            notesRoutes)
app.use('/api/v1/hr',               hrRoutes)
app.use('/api/v1/purchase-orders',  purchaseOrdersRoutes)
app.use('/api/v1/contractors',      contractorsRoutes)

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint nie istnieje' })
})

// Error handler
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`🚀 Kahma API działa na porcie ${env.port} [${env.nodeEnv}]`)
})

export default app
