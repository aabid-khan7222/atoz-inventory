// client/src/components/settings/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext.jsx";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
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
