import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendSignupOTP, verifySignupOTP } from '../api';
import Swal from 'sweetalert2';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: form, 2: OTP verification
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    email: '',
    state: '',
    city: '',
    city_pincode: '',
    address: '',
    has_gst: false,
    gst_number: '',
    company_name: '',
    company_address: '',
    password: '',
    confirm_password: '',
  });
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.mobile_number.trim()) newErrors.mobile_number = 'Mobile number is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.city_pincode.trim()) newErrors.city_pincode = 'Pincode is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (formData.has_gst) {
      if (!formData.gst_number.trim()) newErrors.gst_number = 'GST number is required';
      if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required';
      if (!formData.company_address.trim()) newErrors.company_address = 'Company address is required';
    }
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirm_password) newErrors.confirm_password = 'Please confirm password';
    else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      await Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: 'Please fill all required fields correctly',
        confirmButtonColor: '#e60000',
      });
      return;
    }

    setLoading(true);
    try {
      await sendSignupOTP(formData.email);
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

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      await Swal.fire({
        icon: 'error',
        title: 'Invalid OTP',
        text: 'Please enter a valid 6-digit OTP',
        confirmButtonColor: '#e60000',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await verifySignupOTP({
        ...formData,
        otp,
      });

      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Account Created!',
          text: 'Your account has been created successfully. Please login.',
          confirmButtonColor: '#e60000',
        });
        navigate('/login');
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to create account. Please try again.',
        confirmButtonColor: '#e60000',
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="signup-container">
        <div className="signup-card">
          <div className="signup-header">
            <h1 className="signup-title">Verify Email</h1>
            <p className="signup-subtitle">Enter the OTP sent to {formData.email}</p>
          </div>

          <form onSubmit={handleVerifyOTP} className="signup-form">
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
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

            <button type="submit" className="signup-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              Back to Form
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1 className="signup-title">Create Account</h1>
          <p className="signup-subtitle">Sign up to get started</p>
        </div>

        <form onSubmit={handleSendOTP} className="signup-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="full_name">Full Name *</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Enter full name"
                required
                className={errors.full_name ? 'error' : ''}
              />
              {errors.full_name && <span className="error-text">{errors.full_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="mobile_number">Mobile Number *</label>
              <input
                type="tel"
                id="mobile_number"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleInputChange}
                placeholder="Enter mobile number"
                required
                className={errors.mobile_number ? 'error' : ''}
              />
              {errors.mobile_number && <span className="error-text">{errors.mobile_number}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
                required
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="state">State *</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="Enter state"
                required
                className={errors.state ? 'error' : ''}
              />
              {errors.state && <span className="error-text">{errors.state}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Enter city"
                required
                className={errors.city ? 'error' : ''}
              />
              {errors.city && <span className="error-text">{errors.city}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="city_pincode">City Pincode *</label>
              <input
                type="text"
                id="city_pincode"
                name="city_pincode"
                value={formData.city_pincode}
                onChange={handleInputChange}
                placeholder="Enter pincode"
                required
                className={errors.city_pincode ? 'error' : ''}
              />
              {errors.city_pincode && <span className="error-text">{errors.city_pincode}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Address *</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter full address"
              rows="3"
              required
              className={errors.address ? 'error' : ''}
            />
            {errors.address && <span className="error-text">{errors.address}</span>}
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="has_gst"
                checked={formData.has_gst}
                onChange={handleInputChange}
              />
              <span>Has GST</span>
            </label>
          </div>

          {formData.has_gst && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="gst_number">GST Number *</label>
                  <input
                    type="text"
                    id="gst_number"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleInputChange}
                    placeholder="Enter GST number"
                    className={errors.gst_number ? 'error' : ''}
                  />
                  {errors.gst_number && <span className="error-text">{errors.gst_number}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="company_name">Company Name *</label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    placeholder="Enter company name"
                    className={errors.company_name ? 'error' : ''}
                  />
                  {errors.company_name && <span className="error-text">{errors.company_name}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="company_address">Company Address *</label>
                <textarea
                  id="company_address"
                  name="company_address"
                  value={formData.company_address}
                  onChange={handleInputChange}
                  placeholder="Enter company address"
                  rows="3"
                  className={errors.company_address ? 'error' : ''}
                />
                {errors.company_address && <span className="error-text">{errors.company_address}</span>}
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Set Your Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                required
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm Password *</label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleInputChange}
                placeholder="Confirm password"
                required
                className={errors.confirm_password ? 'error' : ''}
              />
              {errors.confirm_password && <span className="error-text">{errors.confirm_password}</span>}
            </div>
          </div>

          <button type="submit" className="signup-button" disabled={loading}>
            {loading ? 'Sending OTP...' : 'Send OTP & Continue'}
          </button>

          <div className="signup-footer">
            <p>
              Already have an account? <Link to="/login" className="login-link">Login</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
