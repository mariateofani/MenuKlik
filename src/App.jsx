import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Home from './pages/Home.jsx';
import SiteLayout from './layouts/SiteLayout.jsx';
import Simulation, { DemoLayout, DeviceEntry } from './pages/demo/Simulation.jsx';
import Tablet from './pages/dashboard/Tablet.jsx';
import AuthShell from './layouts/AuthShell.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import { SiteAbout, SiteDemo, SiteFaq, SiteFeatures, SiteHome, SiteHow, SitePricing } from './pages/site/SitePages.jsx';
import NotFound from './pages/NotFound.jsx';

import CustomerLayout from './layouts/CustomerLayout.jsx';
import Landing from './pages/customer/Landing.jsx';
import Menu from './pages/customer/Menu.jsx';
import ProductDetail from './pages/customer/ProductDetail.jsx';
import Cart from './pages/customer/Cart.jsx';
import Checkout from './pages/customer/Checkout.jsx';
import Payment from './pages/customer/Payment.jsx';
import OrderTrack from './pages/customer/OrderTrack.jsx';

import StaffLogin from './pages/auth/StaffLogin.jsx';
import Register from './pages/auth/Register.jsx';
import AdminLogin from './pages/auth/AdminLogin.jsx';

import DashboardLayout, { DashboardIndex } from './layouts/DashboardLayout.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Orders from './pages/dashboard/Orders.jsx';
import Kitchen from './pages/dashboard/Kitchen.jsx';
import Waiter from './pages/dashboard/Waiter.jsx';
import MenuManage from './pages/dashboard/MenuManage.jsx';
import Tables from './pages/dashboard/Tables.jsx';
import TablesPrint from './pages/dashboard/TablesPrint.jsx';
import Payments from './pages/dashboard/Payments.jsx';
import Reports from './pages/dashboard/Reports.jsx';
import Settings from './pages/dashboard/Settings.jsx';
import Subscription from './pages/dashboard/Subscription.jsx';
import Help from './pages/dashboard/Help.jsx';
import Staff from './pages/dashboard/Staff.jsx';

import AdminLayout from './layouts/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminRestaurants from './pages/admin/AdminRestaurants.jsx';
import AdminPlans from './pages/admin/AdminPlans.jsx';
import AdminSubscriptions from './pages/admin/AdminSubscriptions.jsx';
import AdminSupport from './pages/admin/AdminSupport.jsx';
import AdminNotice from './pages/admin/AdminNotice.jsx';

// Tema warna: Super Admin biru, semua peran lain dan pelanggan merah-putih.
// Halaman pelanggan (/t/...) selalu memakai tema merek walau tab yang sama sedang masuk sebagai admin.
function ThemeSync() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const admin = !pathname.startsWith('/t/') && (session?.kind === 'admin' || pathname.startsWith('/admin'));
  useEffect(() => {
    document.documentElement.dataset.theme = admin ? 'admin' : 'brand';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', admin ? '#1F5FBF' : '#C62828');
  }, [admin]);
  return null;
}

export default function App() {
  return (
    <>
    <ThemeSync />
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<SiteHome />} />
        <Route path="/fitur" element={<SiteFeatures />} />
        <Route path="/cara-kerja" element={<SiteHow />} />
        <Route path="/harga" element={<SitePricing />} />
        <Route path="/tentang" element={<SiteAbout />} />
        <Route path="/faq" element={<SiteFaq />} />
        <Route path="/coba" element={<SiteDemo />} />
      </Route>
      <Route element={<DemoLayout />}>
        <Route path="/simulasi" element={<Simulation />} />
        <Route path="/demo" element={<Home />} />
      </Route>
      <Route path="/device/entry" element={<DeviceEntry />} />

      {/* Website pelanggan: dibuka dari QR, tanpa login */}
      <Route path="/t/:token" element={<CustomerLayout />}>
        <Route index element={<Landing />} />
        <Route path="menu" element={<Menu />} />
        <Route path="menu/:productId" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders/:orderId" element={<OrderTrack />} />
        <Route path="orders/:orderId/pay" element={<Payment />} />
      </Route>

      {/* Dashboard restoran: Owner, Kasir, Dapur, Waiter */}
      <Route element={<AuthShell />}>
        <Route path="/login" element={<StaffLogin />} />
        <Route path="/daftar" element={<Register />} />
        <Route path="/lupa-password" element={<ForgotPassword />} />
        <Route path="/atur-ulang/:token" element={<ForgotPassword />} />
      </Route>
      <Route path="/dashboard/tables/print" element={<TablesPrint />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardIndex />} />
        <Route path="overview" element={<Overview />} />
        <Route path="orders" element={<Orders />} />
        <Route path="kitchen" element={<Kitchen />} />
        <Route path="waiter" element={<Waiter />} />
        <Route path="tablet" element={<Tablet />} />
        <Route path="menu" element={<MenuManage only="menu" />} />
        <Route path="categories" element={<MenuManage only="categories" />} />
        <Route path="staff" element={<Staff />} />
        <Route path="tables" element={<Tables />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="help" element={<Help />} />
      </Route>

      {/* Super Admin platform */}
      <Route element={<AuthShell />}>
        <Route path="/admin/login" element={<AdminLogin />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/support" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="notice" element={<AdminNotice />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="support" element={<AdminSupport />} />
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}
