// client/src/components/settings/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext.jsx";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import api from "../../api.js";
import "./SettingsPage.css";

// Import API_BASE from api.js
import { API_BASE } from "../../api.js";

// Backend base URL
const API_BASE_URL = API_BASE;

// Supported languages
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "ur", label: "Urdu" },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { language, changeLanguage, t } = useLanguage();
  const { theme, changeTheme } = useTheme();
  const { user, token: authToken } = useAuth();

  // local switches (UI only for now)
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  // security / modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [usernameForm, setUsernameForm] = useState({
    currentPassword: "",
    newUsername: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);

  // Shop details (invoice/bill seller info) - Admin / Super Admin only
  const isAdminOrSuperAdmin = user && (user.role_id === 1 || user.role_id === 2);
  const isSuperAdmin = user && user.role_id === 1;
  const [shopForm, setShopForm] = useState({
    shop_name: "",
    address_line1: "",
    address_line2: "",
    address_line3: "",
    city: "",
    pincode: "",
    state: "",
    state_code: "",
    phone: "",
    email: "",
    gstin: "",
  });
  const [shopLoading, setShopLoading] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState("");
  const [shopSuccess, setShopSuccess] = useState("");

  // Staff & role management - Super Admin only
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(null);

  useEffect(() => {
    if (isAdminOrSuperAdmin) {
      setShopLoading(true);
      api.getShopSettings()
        .then((data) => {
          setShopForm({
            shop_name: data.shop_name || "",
            address_line1: data.address_line1 || "",
            address_line2: data.address_line2 || "",
            address_line3: data.address_line3 || "",
            city: data.city || "",
            pincode: data.pincode || "",
            state: data.state || "",
            state_code: data.state_code || "",
            phone: data.phone || "",
            email: data.email || "",
            gstin: data.gstin || "",
          });
        })
        .catch(() => setShopError("Failed to load shop details"))
        .finally(() => setShopLoading(false));
    }
  }, [isAdminOrSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      setStaffLoading(true);
      api.getStaffUsers()
        .then(setStaffUsers)
        .catch(() => {})
        .finally(() => setStaffLoading(false));
    }
  }, [isSuperAdmin]);

  const handleShopChange = (e) => {
    const { name, value } = e.target;
    setShopForm((prev) => ({ ...prev, [name]: value }));
    setShopError("");
    setShopSuccess("");
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setShopSaving(true);
    setShopError("");
    setShopSuccess("");
    try {
      await api.updateShopSettings(shopForm);
      setShopSuccess("Shop details saved. They will appear on new invoices.");
    } catch (err) {
      setShopError(err.message || "Failed to save");
    } finally {
      setShopSaving(false);
    }
  };

  const handleRoleChange = async (userId, newRoleId) => {
    setRoleUpdating(userId);
    try {
      await api.updateUserRole(userId, newRoleId);
      setStaffUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role_id: newRoleId, role_name: newRoleId === 1 ? "Super Admin" : newRoleId === 2 ? "Admin" : "Customer" } : u))
      );
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const toggleTheme = () => {
    changeTheme(theme === "light" ? "dark" : "light");
  };

  // ---------- USERNAME MODAL ----------

  const openUsernameModal = () => {
    setUsernameForm({
      currentPassword: "",
      newUsername: "",
    });
    setUsernameError("");
    setUsernameSuccess("");
    setShowUsernameModal(true);
  };

  const closeUsernameModal = () => {
    setShowUsernameModal(false);
    setUsernameError("");
    setUsernameLoading(false);
    setUsernameForm({
      currentPassword: "",
      newUsername: "",
    });
  };

  const handleUsernameInputChange = (e) => {
    const { name, value } = e.target;
    setUsernameForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setUsernameError("");
    setUsernameSuccess("");

    const { currentPassword, newUsername } = usernameForm;

    if (!currentPassword || !newUsername) {
      setUsernameError("All fields are required.");
      return;
    }

    if (!newUsername.trim()) {
      setUsernameError("Username cannot be empty.");
      return;
    }

    // ---- AUTH INFO FROM CONTEXT AND LOCALSTORAGE ----
    const token = authToken || localStorage.getItem("auth_token");

    if (!token) {
      setUsernameError("You need to be logged in to change your username.");
      return;
    }

    // headers build karo
    const headers = {
      "Content-Type": "application/json",
    };
    headers.Authorization = `Bearer ${token}`;

    setUsernameLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-username`, {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, newUsername: newUsername.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setUsernameError(data.error || "Failed to change username.");
        setUsernameLoading(false);
        return;
      }

      // ✅ USERNAME SUCCESS: logout and redirect to login (same as password change)
      setUsernameSuccess("Username updated successfully!");
      setUsernameLoading(false);

      // Clear auth info immediately
      ["auth_user", "auth_token"].forEach((k) => localStorage.removeItem(k));

      // Close modal (optional, kyunki redirect turant ho raha hai)
      closeUsernameModal();

      // Redirect to login using React Router
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Change username error:", err);
      setUsernameError("Server error while changing username.");
      setUsernameLoading(false);
    }
  };

  // ---------- PASSWORD MODAL ----------

  const openPasswordModal = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError("");
    setPasswordLoading(false);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("settings.security.allFieldsRequired"));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t("settings.security.passwordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.security.passwordMismatch"));
      return;
    }

    const token = authToken || localStorage.getItem("auth_token"); // optional

    if (!token) {
      setPasswordError("You need to be logged in to change your password.");
      return;
    }

    // headers build karo
    const headers = {
      "Content-Type": "application/json",
    };
    headers.Authorization = `Bearer ${token}`;

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setPasswordError(data.error || "Failed to change password.");
        setPasswordLoading(false);
        return;
      }

      // ✅ PASSWORD SUCCESS: force re-login for every role
      setPasswordSuccess(t("settings.security.passwordUpdated"));
      setPasswordLoading(false);

      // clear auth info
      ["auth_user", "auth_token"].forEach((k) => localStorage.removeItem(k));

      // close modal (optional, kyunki redirect turant ho raha hai)
      closePasswordModal();

      // Redirect to login using React Router
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError("Server error while changing password.");
      setPasswordLoading(false);
    }
  };

  // ---------- LOGOUT MODAL ----------

  const openLogoutModal = () => {
    setLogoutError("");
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
    setLogoutError("");
    setLogoutLoading(false);
  };

  const handleLogoutConfirm = async () => {
    setLogoutError("");

    const token = authToken || localStorage.getItem("auth_token"); // optional

    if (!token) {
      setLogoutError("You need to be logged in to logout everywhere.");
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    setLogoutLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/logout-all`, {
        method: "POST",
        headers,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setLogoutError(data.error || "Failed to logout from all devices.");
        setLogoutLoading(false);
        return;
      }

      // Clear local auth + redirect
      ["auth_user", "auth_token"].forEach((k) => localStorage.removeItem(k));
      setLogoutLoading(false);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout-all error:", err);
      setLogoutError("Server error while logging out.");
      setLogoutLoading(false);
    }
  };

  // ---------- JSX ----------

  return (
    <div className="settings-page">
      {/* Top bar with back button */}
      <div className="settings-header">
        <button className="settings-back-btn" onClick={handleBack}>
          ← {t("common.back")}
        </button>
        <div className="settings-header-text">
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="settings-grid">
        {/* Language */}
        <section className="settings-card">
          <h2>{t("settings.language.title")}</h2>
          <p className="settings-helper">
            {t("settings.language.description")}
          </p>

          <div className="settings-select-wrapper">
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <p className="settings-small">
            {t("settings.language.note")}
          </p>
        </section>

        {/* Theme (dark / light) */}
        <section className="settings-card">
          <h2>{t("settings.theme.title")}</h2>
          <p className="settings-helper">
            {t("settings.theme.description")}
          </p>

          <div className="settings-toggle-row">
            <span className="settings-toggle-label">
              {theme === "light" ? t("settings.theme.lightMode") : t("settings.theme.darkMode")}
            </span>

            <button
              type="button"
              className={`toggle-pill ${theme === "dark" ? "on" : ""}`}
              onClick={toggleTheme}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-card">
          <h2>{t("settings.notifications.title")}</h2>
          <p className="settings-helper">
            {t("settings.notifications.description")}
          </p>

          <div className="settings-toggle-row">
            <span className="settings-toggle-label">{t("settings.notifications.emailAlerts")}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-toggle-row">
            <span className="settings-toggle-label">{t("settings.notifications.smsAlerts")}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-toggle-row">
            <span className="settings-toggle-label">{t("settings.notifications.twoFactor")}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={twoFactor}
                onChange={(e) => setTwoFactor(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
        </section>

        {/* Shop / Business details (invoice bill) - Admin & Super Admin only */}
        {isAdminOrSuperAdmin && (
          <section className="settings-card">
            <h2>Shop / Business details (Invoice & Bill)</h2>
            <p className="settings-helper">
              Ye details invoice aur bill par dikhengi: shop name, address, state, state code, mobile, email, GST number.
            </p>
            {shopLoading ? (
              <p className="settings-small">Loading...</p>
            ) : (
              <form onSubmit={handleShopSubmit}>
                {shopError && <p className="settings-modal-error">{shopError}</p>}
                {shopSuccess && <p className="settings-success-text">{shopSuccess}</p>}
                <div className="settings-form-grid">
                  <label>Shop / Business name *</label>
                  <input type="text" name="shop_name" value={shopForm.shop_name} onChange={handleShopChange} required placeholder="e.g. A TO Z BATTERIES & ELECTRICAL PARTS" />
                  <label>Address line 1</label>
                  <input type="text" name="address_line1" value={shopForm.address_line1} onChange={handleShopChange} placeholder="e.g. Near Ajanta Chawfully," />
                  <label>Address line 2</label>
                  <input type="text" name="address_line2" value={shopForm.address_line2} onChange={handleShopChange} placeholder="e.g. Front of HP Petrol Pump," />
                  <label>Address line 3</label>
                  <input type="text" name="address_line3" value={shopForm.address_line3} onChange={handleShopChange} placeholder="e.g. Taiba Washing," />
                  <label>City</label>
                  <input type="text" name="city" value={shopForm.city} onChange={handleShopChange} placeholder="e.g. Jalgaon" />
                  <label>Pincode</label>
                  <input type="text" name="pincode" value={shopForm.pincode} onChange={handleShopChange} placeholder="e.g. 425001" maxLength={6} />
                  <label>State</label>
                  <input type="text" name="state" value={shopForm.state} onChange={handleShopChange} placeholder="e.g. Maharashtra" />
                  <label>State code (GST)</label>
                  <input type="text" name="state_code" value={shopForm.state_code} onChange={handleShopChange} placeholder="e.g. 27" maxLength={2} />
                  <label>Phone / Mobile</label>
                  <input type="text" name="phone" value={shopForm.phone} onChange={handleShopChange} placeholder="e.g. 9890412516" maxLength={15} />
                  <label>Email</label>
                  <input type="email" name="email" value={shopForm.email} onChange={handleShopChange} placeholder="e.g. shop@example.com" />
                  <label>GSTIN</label>
                  <input type="text" name="gstin" value={shopForm.gstin} onChange={handleShopChange} placeholder="e.g. 27CHVPP1094F1ZT" />
                </div>
                <div className="settings-actions" style={{ marginTop: "12px" }}>
                  <button type="submit" className="settings-save-btn" disabled={shopSaving}>
                    {shopSaving ? "Saving..." : "Save shop details"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Staff & role (Admin / Super Admin) - Super Admin only */}
        {isSuperAdmin && (
          <section className="settings-card">
            <h2>Staff & role (Admin / Super Admin)</h2>
            <p className="settings-helper">
              Kisi user ko Admin ya Super Admin bana sakte ho. Role change karne se us user ki access change hogi.
            </p>
            {staffLoading ? (
              <p className="settings-small">Loading users...</p>
            ) : (
              <div className="settings-staff-table-wrap">
                <table className="settings-staff-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / Phone</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name || "—"}</td>
                        <td>{u.email || u.phone || "—"}</td>
                        <td>
                          <select
                            value={u.role_id}
                            onChange={(e) => handleRoleChange(u.id, Number(e.target.value))}
                            disabled={roleUpdating === u.id}
                          >
                            <option value={1}>Super Admin</option>
                            <option value={2}>Admin</option>
                            <option value={3}>Customer</option>
                          </select>
                          {roleUpdating === u.id && <span className="settings-small"> Updating...</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Security / password */}
        <section className="settings-card settings-card--security">
          <h2>{t("settings.security.title")}</h2>
          <p className="settings-helper">
            {t("settings.security.description")}
          </p>
          {passwordSuccess && (
            <p className="settings-success-text">{passwordSuccess}</p>
          )}

          <div className="settings-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={openUsernameModal}
            >
              Change Username
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={openPasswordModal}
            >
              {t("settings.security.changePassword")}
            </button>

            <button
              type="button"
              className="btn-danger"
              onClick={openLogoutModal}
            >
              {t("settings.security.logoutAll")}
            </button>
          </div>
        </section>
      </div>

      {/* Change username modal */}
      {showUsernameModal && (
        <div className="settings-modal-backdrop">
          <div className="settings-modal">
            <h3>{t("settings.security.changeUsername") || "Change Your Username"}</h3>
            {usernameError && (
              <div className="settings-modal-error">{usernameError}</div>
            )}
            {usernameSuccess && (
              <div className="settings-modal-success">{usernameSuccess}</div>
            )}
            <form onSubmit={handleUsernameSubmit}>
              <label>
                {t("settings.security.currentPassword") || "Current Password"}
                <div className="password-input-wrapper">
                  <input
                    type={showUsernamePassword ? "text" : "password"}
                    name="currentPassword"
                    value={usernameForm.currentPassword}
                    onChange={handleUsernameInputChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-toggle"
                    onClick={() =>
                      setShowUsernamePassword(!showUsernamePassword)
                    }
                  >
                    {showUsernamePassword ? "🙈" : "👁"}
                  </button>
                </div>
              </label>
              <label>
                {t("settings.security.newUsername") || "New Username"}
                <input
                  type="text"
                  name="newUsername"
                  value={usernameForm.newUsername}
                  onChange={handleUsernameInputChange}
                  required
                  placeholder="Enter new username"
                />
              </label>
              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closeUsernameModal}
                  disabled={usernameLoading}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={usernameLoading}
                >
                  {usernameLoading ? (t("settings.security.saving") || "Saving...") : "Save Username"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="settings-modal-backdrop">
          <div className="settings-modal">
            <h3>{t("settings.security.changePassword")}</h3>
            {passwordError && (
              <div className="settings-modal-error">{passwordError}</div>
            )}
            <form onSubmit={handlePasswordSubmit}>
              <label>
                {t("settings.security.currentPassword")}
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.current ? "text" : "password"}
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordInputChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-toggle"
                    onClick={() =>
                      setShowPassword((prev) => ({
                        ...prev,
                        current: !prev.current,
                      }))
                    }
                  >
                    {showPassword.current ? "🙈" : "👁"}
                  </button>
                </div>
              </label>
              <label>
                {t("settings.security.newPassword")}
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.new ? "text" : "password"}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordInputChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-toggle"
                    onClick={() =>
                      setShowPassword((prev) => ({
                        ...prev,
                        new: !prev.new,
                      }))
                    }
                  >
                    {showPassword.new ? "🙈" : "👁"}
                  </button>
                </div>
              </label>
              <label>
                {t("settings.security.confirmPassword")}
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordInputChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-toggle"
                    onClick={() =>
                      setShowPassword((prev) => ({
                        ...prev,
                        confirm: !prev.confirm,
                      }))
                    }
                  >
                    {showPassword.confirm ? "🙈" : "👁"}
                  </button>
                </div>
              </label>
              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closePasswordModal}
                  disabled={passwordLoading}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? t("settings.security.saving") : t("settings.security.savePassword")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout modal */}
      {showLogoutModal && (
        <div className="settings-modal-backdrop">
          <div className="settings-modal">
            <h3>{t("settings.security.logoutConfirm")}</h3>
            <p>
              {t("settings.security.logoutDescription")}
            </p>
            {logoutError && (
              <div className="settings-modal-error">{logoutError}</div>
            )}
            <div className="settings-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={closeLogoutModal}
                disabled={logoutLoading}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleLogoutConfirm}
                disabled={logoutLoading}
              >
                {logoutLoading ? t("settings.security.loggingOut") : t("settings.security.logoutEverywhere")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
