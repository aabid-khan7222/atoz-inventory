import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      
      // Redirect based on role_id
      if (user.role_id === 1) {
        navigate("/super-admin", { replace: true });
      } else if (user.role_id === 2) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/customer", { replace: true });
      }
      
      setLoading(false);
    } catch (err) {
      setError(err.message || t('login.invalidCredentials'));
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">{t('login.title')}</h1>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form" action="#" method="post">
          <div className="form-group">
            <label htmlFor="email">{t('login.email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.enterEmail')}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.enterPassword')}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? t('login.loggingIn') : t('login.login')}
          </button>

          <div className="login-footer">
            <Link to="/signup" className="signup-link">
              Create Account / Sign Up
            </Link>
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

