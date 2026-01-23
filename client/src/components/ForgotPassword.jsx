import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendForgotPasswordOTP, verifyForgotPasswordOTP } from '../api';
import Swal from 'sweetalert2';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSendOTP = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Invalid email format' });
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await sendForgotPasswordOTP(email.trim());
      setStep(2);
      await Swal.fire({
        icon: 'success',
        title: 'OTP Sent!',
        text: 'Please check your email for the verification code',
        confirmButtonColor: '#e60000',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to send OTP. Please try again.',
        confirmButtonColor: '#e60000',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!otp || otp.length !== 6) {
      newErrors.otp = 'Please enter a valid 6-digit OTP';
    }
    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await verifyForgotPasswordOTP({
        email: email.trim(),
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      await Swal.fire({
        icon: 'success',
        title: 'Password Reset!',
        text: 'Your password has been reset successfully. Please login with your new password.',
        confirmButtonColor: '#e60000',
      });
      navigate('/login');
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to reset password. Please try again.',
        confirmButtonColor: '#e60000',
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <div className="forgot-password-header">
            <h1 className="forgot-password-title">Reset Password</h1>
            <p className="forgot-password-subtitle">
              Enter the OTP sent to {email}
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="forgot-password-form">
            <div className="form-group">
              <label htmlFor="otp">Enter OTP *</label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                required
                autoFocus
                className={errors.otp ? 'error' : ''}
              />
              {errors.otp && <span className="error-text">{errors.otp}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password *</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.newPassword;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter new password"
                required
                className={errors.newPassword ? 'error' : ''}
              />
              {errors.newPassword && (
                <span className="error-text">{errors.newPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.confirmPassword;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Confirm new password"
                required
                className={errors.confirmPassword ? 'error' : ''}
              />
              {errors.confirmPassword && (
                <span className="error-text">{errors.confirmPassword}</span>
              )}
            </div>

            <button
              type="submit"
              className="forgot-password-button"
              disabled={loading}
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <div className="forgot-password-header">
          <h1 className="forgot-password-title">Forgot Password</h1>
          <p className="forgot-password-subtitle">
            Enter your email address and we'll send you an OTP to reset your password
          </p>
        </div>

        <form onSubmit={handleSendOTP} className="forgot-password-form">
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.email;
                    return newErrors;
                  });
                }
              }}
              placeholder="Enter your email address"
              required
              autoFocus
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <button
            type="submit"
            className="forgot-password-button"
            disabled={loading}
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>

          <div className="forgot-password-footer">
            <p>
              Remember your password? <Link to="/login" className="login-link">Login</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
