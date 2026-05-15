import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import UsersPage from '@/pages/admin/Users'
import VehiclesPage from '@/pages/admin/Vehicles'
import LocationsPage from '@/pages/admin/Locations'
import DayOverview from '@/pages/admin/DayOverview'
import ReportsPage from '@/pages/reports/ReportsPage'
import ReportForm from '@/pages/reports/ReportForm'
import EquipmentPage from '@/pages/equipment/EquipmentPage'
import MaterialsPage from '@/pages/materials/MaterialsPage'
import HelpPage from '@/pages/HelpPage'
import NotesPage from '@/pages/notes/NotesPage'
import HrPage from '@/pages/hr/HrPage'
import PurchasesPage from '@/pages/purchases/PurchasesPage'
import ContractorsPage from '@/pages/admin/Contractors'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin())
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <GuestOnly><AuthLayout /></GuestOnly>,
    children: [{ index: true, element: <Login /> }],
  },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'raporty', element: <ReportsPage /> },
      { path: 'raporty/nowy', element: <ReportForm /> },
      { path: 'raporty/:id', element: <ReportForm /> },
      { path: 'sprzet', element: <EquipmentPage /> },
      { path: 'materialy', element: <MaterialsPage /> },
      { path: 'notatki',    element: <NotesPage /> },
      { path: 'hr',         element: <HrPage /> },
      { path: 'zakupy',     element: <PurchasesPage /> },
      { path: 'instrukcja', element: <HelpPage /> },
      {
        path: 'admin/users',
        element: <RequireAdmin><UsersPage /></RequireAdmin>,
      },
      {
        path: 'admin/pojazdy',
        element: <RequireAdmin><VehiclesPage /></RequireAdmin>,
      },
      {
        path: 'admin/lokalizacje',
        element: <RequireAdmin><LocationsPage /></RequireAdmin>,
      },
      {
        path: 'admin/kontrahenci',
        element: <RequireAdmin><ContractorsPage /></RequireAdmin>,
      },
      {
        path: 'admin/przeglad-dnia',
        element: <RequireAdmin><DayOverview /></RequireAdmin>,
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
