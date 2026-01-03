import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import { AuthRoute, AdminRoute, SuperAdminRoute, CustomerRoute } from "./routes/ProtectedRoutes";
import Login from "./components/Login.jsx";
import ProfilePage from "./components/profile/ProfilePage.jsx";
import SettingsPage from "./components/settings/SettingsPage.jsx";
import SuperAdminDashboardPage from "./pages/SuperAdminDashboardPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import CustomerDashboardPage from "./pages/CustomerDashboardPage.jsx";
import Invoice from "./components/invoice/Invoice.jsx";
import "./App.css";

function App() {
  const { isAuthenticated, loading, user } = useAuth();

  // loading screen
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#f5f5f5",
          color: "#333",
        }}
      >
        Loading...
      </div>
    );
  }

  // Public route wrapper for login
  const PublicRoute = ({ children }) => {
    if (isAuthenticated) {
      // Redirect based on role
      if (user?.role_id === 1) {
        return <Navigate to="/super-admin" replace />;
      } else if (user?.role_id === 2) {
        return <Navigate to="/admin" replace />;
      } else if (user?.role_id >= 3) {
        return <Navigate to="/customer" replace />;
      }
      // Any unknown role is disallowed
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // Default route redirect based on role
  const DefaultRoute = () => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (user.role_id === 1) {
      return <Navigate to="/super-admin" replace />;
    } else if (user.role_id === 2) {
      return <Navigate to="/admin" replace />;
    } else if (user.role_id >= 3) {
      return <Navigate to="/customer" replace />;
    }
    return <Navigate to="/login" replace />;
  };

  return (
    <Routes>
      {/* Login page */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Default route - redirects based on role */}
      <Route path="/" element={<DefaultRoute />} />

      {/* Super Admin routes */}
      <Route element={<SuperAdminRoute />}>
        <Route path="/super-admin" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/settings" element={<SettingsPage />} />
        <Route path="/super-admin/user-management" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/inventory" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/products" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/sales" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/pending-orders" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/charging" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/services" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/guarantee-warranty" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/company-returns" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/reports" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/employees" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/employee-management" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/history" element={<Navigate to="/super-admin" replace />} />
        <Route path="/super-admin/profile" element={<ProfilePage />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/user-management" element={<AdminDashboardPage />} />
        <Route path="/admin/inventory" element={<AdminDashboardPage />} />
        <Route path="/admin/products" element={<AdminDashboardPage />} />
        <Route path="/admin/sales" element={<AdminDashboardPage />} />
        <Route path="/admin/pending-orders" element={<AdminDashboardPage />} />
        <Route path="/admin/charging" element={<AdminDashboardPage />} />
        <Route path="/admin/services" element={<AdminDashboardPage />} />
        <Route path="/admin/guarantee-warranty" element={<AdminDashboardPage />} />
        <Route path="/admin/company-returns" element={<AdminDashboardPage />} />
        <Route path="/admin/reports" element={<AdminDashboardPage />} />
        <Route path="/admin/employees" element={<AdminDashboardPage />} />
        <Route path="/admin/employee-management" element={<AdminDashboardPage />} />
        <Route path="/admin/history" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/profile" element={<ProfilePage />} />
        <Route path="/admin/invoice/:invoiceNumber" element={<Invoice />} />
      </Route>

      {/* Customer routes */}
      <Route element={<CustomerRoute />}>
        <Route path="/customer" element={<CustomerDashboardPage />} />
        <Route path="/customer/settings" element={<SettingsPage />} />
        <Route path="/customer/products" element={<CustomerDashboardPage />} />
        <Route path="/customer/checkout" element={<CustomerDashboardPage />} />
        <Route path="/customer/orders" element={<CustomerDashboardPage />} />
        <Route path="/customer/charging" element={<CustomerDashboardPage />} />
        <Route path="/customer/services" element={<CustomerDashboardPage />} />
        <Route path="/customer/guarantee-warranty" element={<CustomerDashboardPage />} />
        <Route path="/customer/reports" element={<CustomerDashboardPage />} />
        <Route path="/customer/history" element={<Navigate to="/customer" replace />} />
        <Route path="/customer/profile" element={<ProfilePage />} />
        <Route path="/customer/invoice/:invoiceNumber" element={<Invoice />} />
      </Route>

      {/* Invoice route (accessible by all authenticated users) */}
      <Route element={<AuthRoute />}>
        <Route path="/invoice/:invoiceNumber" element={<Invoice />} />
      </Route>

      {/* Super Admin invoice route */}
      <Route element={<SuperAdminRoute />}>
        <Route path="/super-admin/invoice/:invoiceNumber" element={<Invoice />} />
      </Route>

      {/* Catch-all route - redirect invalid routes to appropriate dashboard */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            user?.role_id === 1 ? (
              <Navigate to="/super-admin" replace />
            ) : user?.role_id === 2 ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/customer" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
