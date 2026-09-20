import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { Toasts, Spinner } from './components/UI';

import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';

// Public pages load eagerly — they are the first thing a visitor sees.
import Home from './pages/public/Home';
import Services from './pages/public/Services';
import ServiceDetail from './pages/public/ServiceDetail';
import DivisionDetail from './pages/public/DivisionDetail';
import Work from './pages/public/Work';
import WorkDetail from './pages/public/WorkDetail';
import Packages from './pages/public/Packages';
import EquipmentCatalogue from './pages/public/EquipmentCatalogue';
import PrintShop from './pages/public/PrintShop';
import Insights from './pages/public/Insights';
import PostDetail from './pages/public/PostDetail';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Login from './pages/auth/Login';
import PublicQuote from './pages/public/PublicQuote';
import PublicInvoice from './pages/public/PublicInvoice';
import NotFound from './pages/public/NotFound';

// Admin and portal are behind auth, so they can be split out of the main bundle.
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const LeadsPage = lazy(() => import('./pages/admin/Leads'));
const OrganisationsPage = lazy(() => import('./pages/admin/Organisations'));
const QuotesPage = lazy(() => import('./pages/admin/Quotes'));
const QuoteEditor = lazy(() => import('./pages/admin/QuoteEditor'));
const ProjectsPage = lazy(() => import('./pages/admin/Projects'));
const ProjectDetail = lazy(() => import('./pages/admin/ProjectDetail'));
const InvoicesPage = lazy(() => import('./pages/admin/Invoices'));
const InvoiceEditor = lazy(() => import('./pages/admin/InvoiceEditor'));
const EquipmentAdmin = lazy(() => import('./pages/admin/Equipment'));
const BookingsAdmin = lazy(() => import('./pages/admin/Bookings'));
const PrintAdmin = lazy(() => import('./pages/admin/PrintOrders'));
const EventsAdmin = lazy(() => import('./pages/admin/Events'));
const ContentAdmin = lazy(() => import('./pages/admin/Content'));
const MediaLibrary = lazy(() => import('./pages/admin/MediaLibrary'));
const SuppliersAdmin = lazy(() => import('./pages/admin/Suppliers'));
const SubscriptionsAdmin = lazy(() => import('./pages/admin/Subscriptions'));
const AiAdmin = lazy(() => import('./pages/admin/AiAssistants'));
const UsersAdmin = lazy(() => import('./pages/admin/Users'));
const SettingsAdmin = lazy(() => import('./pages/admin/Settings'));
const ReportsAdmin = lazy(() => import('./pages/admin/Reports'));

const PortalHome = lazy(() => import('./pages/portal/PortalHome'));
const PortalProjects = lazy(() => import('./pages/portal/PortalProjects'));
const PortalProjectDetail = lazy(() => import('./pages/portal/PortalProjectDetail'));
const PortalInvoices = lazy(() => import('./pages/portal/PortalInvoices'));
const PortalRequests = lazy(() => import('./pages/portal/PortalRequests'));

function RequireAuth({ roles, children }) {
  const { user, loading } = useApp();
  const location = useLocation();

  if (loading) return <Spinner center />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role_slug)) {
    // Send people to the area their role actually belongs in.
    return <Navigate to={user.role_slug === 'client' ? '/portal' : '/admin'} replace />;
  }
  return children;
}

export default function App() {
  const { toasts, dismissToast } = useApp();

  return (
    <>
      <Suspense fallback={<Spinner center />}>
        <Routes>
          {/* ------------------------------------------------ PUBLIC SITE */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="services/:slug" element={<DivisionDetail />} />
            <Route path="service/:slug" element={<ServiceDetail />} />
            <Route path="work" element={<Work />} />
            <Route path="work/:slug" element={<WorkDetail />} />
            <Route path="packages" element={<Packages />} />
            <Route path="equipment" element={<EquipmentCatalogue />} />
            <Route path="print" element={<PrintShop />} />
            <Route path="insights" element={<Insights />} />
            <Route path="insights/:slug" element={<PostDetail />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="q/:token" element={<PublicQuote />} />
            <Route path="i/:token" element={<PublicInvoice />} />
          </Route>

          <Route path="/login" element={<Login />} />

          {/* ------------------------------------------------------ ADMIN */}
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin', 'staff']}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="clients" element={<OrganisationsPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="quotes/new" element={<QuoteEditor />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/new" element={<InvoiceEditor />} />
            <Route path="invoices/:id" element={<InvoiceEditor />} />
            <Route path="equipment" element={<EquipmentAdmin />} />
            <Route path="bookings" element={<BookingsAdmin />} />
            <Route path="print-orders" element={<PrintAdmin />} />
            <Route path="events" element={<EventsAdmin />} />
            <Route path="content/*" element={<ContentAdmin />} />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="suppliers" element={<SuppliersAdmin />} />
            <Route path="subscriptions" element={<SubscriptionsAdmin />} />
            <Route path="ai" element={<AiAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="reports" element={<ReportsAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Route>

          {/* --------------------------------------------- CLIENT PORTAL */}
          <Route
            path="/portal"
            element={
              <RequireAuth roles={['client']}>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route index element={<PortalHome />} />
            <Route path="projects" element={<PortalProjects />} />
            <Route path="projects/:id" element={<PortalProjectDetail />} />
            <Route path="invoices" element={<PortalInvoices />} />
            <Route path="requests" element={<PortalRequests />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
