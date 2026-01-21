import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { updateUserProfile as apiUpdateUserProfile } from "../../api";
import Swal from 'sweetalert2';
import "./ProfilePage.css";

const initialGstDetails = {
  gstNumber: "",
  companyName: "",
  companyAddress: "",
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, logout, updateUserProfile, updateUser } =
    useAuth();
  const { theme } = useTheme();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    state: "",
    city: "",
    pincode: "",
    gstNumber: "",
    address: "",
    companyName: "",
    companyAddress: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showGstDetails, setShowGstDetails] = useState(false);
  const fileInputRef = useRef(null);
  const currentTheme = theme || "light";

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user)) {
      navigate("/login", { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (user) {
      const userGstDetails = {
        gstNumber:
          user.gstDetails?.gstNumber || user.gst_number || user.company_gst || "",
        companyName: user.gstDetails?.companyName || user.company || "",
        companyAddress:
          user.gstDetails?.companyAddress || user.company_address || "",
      };
      setFormData({
        fullName: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        state: user.state || "",
        city: user.city || "",
        pincode: user.pincode || "",
        gstNumber: user.gst_number || userGstDetails.gstNumber || "",
        address: user.address || "",
        companyName: userGstDetails.companyName || "",
        companyAddress: userGstDetails.companyAddress || "",
      });
      setShowGstDetails(
        Boolean(
          userGstDetails.gstNumber ||
            userGstDetails.companyName ||
            userGstDetails.companyAddress
        )
      );
      setAvatarPreview(user.avatar_url || user.avatar || user.profileImage || user.profile_image_url || "");
    }
  }, [user]);

  const initials = useMemo(() => {
    if (!user?.full_name) return "NA";
    return user.full_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }, [user]);

  const roleModifier = useMemo(() => {
    return (user?.role_name || "customer").toLowerCase().replace("_", "-");
  }, [user]);


  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGstFieldFocus = () => {
    if (!showGstDetails) {
      setShowGstDetails(true);
    }
  };

  const toggleGstDetails = () => {
    setShowGstDetails((prev) => !prev);
  };

  const handleEditToggle = () => {
    setIsEditing(true);
    setStatus(null);
  };

  const handleCancel = () => {
    if (!user) return;
    const userGstDetails = {
      gstNumber:
        user.gstDetails?.gstNumber || user.gst_number || user.company_gst || "",
      companyName: user.gstDetails?.companyName || user.company || "",
      companyAddress:
        user.gstDetails?.companyAddress || user.company_address || "",
    };
    setFormData({
      fullName: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      state: user.state || "",
      city: user.city || "",
        pincode: user.pincode || "",
      gstNumber: user.gst_number || userGstDetails.gstNumber || "",
      address: user.address || "",
      companyName: userGstDetails.companyName || "",
      companyAddress: userGstDetails.companyAddress || "",
    });
    setShowGstDetails(
      Boolean(
        userGstDetails.gstNumber ||
          userGstDetails.companyName ||
          userGstDetails.companyAddress
      )
    );
    setIsEditing(false);
    setStatus(null);
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    if (!formData.fullName.trim()) {
      setStatus({ type: "error", message: "Full name is required." });
      return;
    }

    if (!user || !user.id) {
      setStatus({ type: "error", message: "User not found." });
      return;
    }

    try {
      // Always send GST fields - empty strings mean "clear this field", undefined means "don't change"
      // Since we're always sending them from formData, empty strings will clear existing values
      const profileData = {
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        state: formData.state,
        city: formData.city,
        address: formData.address,
        pincode: formData.pincode,
        // Always send GST fields - empty strings will clear them, non-empty will set them
        gst_number: formData.gstNumber || "",
        company_name: formData.companyName || "",
        company_address: formData.companyAddress || "",
      };

      // Call the API to save to database
      const response = await apiUpdateUserProfile(profileData);

      if (!response.success) {
        throw new Error(response.error || "Failed to update profile");
      }

      // Update local state with the response from server
      if (response.user) {
        updateUser({
          full_name: response.user.full_name,
          email: response.user.email,
          phone: response.user.phone,
          state: response.user.state,
          city: response.user.city,
          pincode: response.user.pincode,
          address: response.user.address,
          gst_number: response.user.gst_number,
          company_name: response.user.company_name,
          company_address: response.user.company_address,
          company: response.user.company_name,
        });
      }

      setStatus({ type: "success", message: "Profile updated successfully." });
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      setStatus({
        type: "error",
        message: error?.message || "Failed to update profile.",
      });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatus({
        type: "error",
        message: "Image size must be less than 5MB.",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatus({
        type: "error",
        message: "Please select a valid image file.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result === "string") {
        const newUrl = result;
        
        try {
          // Update local preview immediately for better UX
          setAvatarPreview(newUrl);
          
          // Save avatar to database via API
          // IMPORTANT: Include email to preserve it (don't let it become null)
          const profileData = {
            avatar_url: newUrl,
            // Include existing profile data to avoid validation errors
            full_name: formData.fullName || user?.full_name || "",
            email: formData.email || user?.email || "", // Preserve email!
            phone: formData.phone || user?.phone || "",
          };

          const response = await apiUpdateUserProfile(profileData);

          if (!response.success) {
            throw new Error(response.error || "Failed to save profile photo");
          }

          // Update user context with the saved avatar
          if (response.user) {
            updateUser({
              ...response.user,
              avatar_url: response.user.avatar_url || newUrl,
              profileImage: response.user.avatar_url || newUrl,
              profile_image_url: response.user.avatar_url || newUrl,
              avatar: response.user.avatar_url || newUrl,
            });
          } else {
            // Fallback: update local state if response doesn't have user
            updateUser({
              avatar_url: newUrl,
              profileImage: newUrl,
              profile_image_url: newUrl,
              avatar: newUrl,
            });
          }

          // Update local profile state
          updateUserProfile({ avatar: newUrl });

          setStatus({
            type: "success",
            message: "Profile photo updated successfully.",
          });
        } catch (error) {
          console.error('Avatar upload error:', error);
          setStatus({
            type: "error",
            message: error?.message || "Failed to save profile photo. Please try again.",
          });
          // Revert preview on error
          setAvatarPreview(user?.avatar_url || user?.avatar || "");
        }
      }
    };
    reader.onerror = () => {
      setStatus({
        type: "error",
        message: "Unable to read the selected image.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    try {
      // Confirm removal
      const result = await Swal.fire({
        title: 'Remove profile photo?',
        text: 'This will remove your profile photo permanently.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, remove it',
        cancelButtonText: 'Cancel'
      });

      if (!result.isConfirmed) return;

      // Save null avatar to database via API
      const profileData = {
        avatar_url: null, // Explicitly set to null to remove
        // Include existing profile data to avoid validation errors
        full_name: formData.fullName || user?.full_name || "",
        email: formData.email || user?.email || "",
        phone: formData.phone || user?.phone || "",
      };

      const response = await apiUpdateUserProfile(profileData);

      if (!response.success) {
        throw new Error(response.error || "Failed to remove profile photo");
      }

      // Clear local preview
      setAvatarPreview("");

      // Update user context
      if (response.user) {
        updateUser({
          ...response.user,
          avatar_url: null,
          profileImage: null,
          profile_image_url: null,
          avatar: null,
        });
      } else {
        // Fallback: update local state
        updateUser({
          avatar_url: null,
          profileImage: null,
          profile_image_url: null,
          avatar: null,
        });
      }

      // Update local profile state
      updateUserProfile({ avatar: null });

      setStatus({
        type: "success",
        message: "Profile photo removed successfully.",
      });
    } catch (error) {
      console.error('Remove photo error:', error);
      setStatus({
        type: "error",
        message: error?.message || "Failed to remove profile photo. Please try again.",
      });
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to sign out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, sign out',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;
    logout();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className={`profile-page profile-page--${currentTheme} profile-page__loading`}>
        <p>Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`profile-page profile-page--${currentTheme}`}>
      <div className="profile-card">
        <div className="profile-header">
          <button type="button" className="back-button" onClick={() => navigate(-1)}>
            Back
          </button>
          <h1>Your Profile</h1>
        </div>

        <div className="profile-body">
          <div className="profile-section avatar-section">
            <div className="avatar-wrapper" onClick={handleAvatarClick}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="avatar-image" />
              ) : (
                <span className="avatar-initials">{initials}</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="avatar-input"
                onChange={handleAvatarChange}
                hidden
              />
            </div>
            <div className="avatar-actions">
              <button type="button" className="change-photo-btn" onClick={handleAvatarClick}>
                Change photo
              </button>
              {avatarPreview && (
                <button type="button" className="remove-photo-btn" onClick={handleRemovePhoto}>
                  Remove photo
                </button>
              )}
            </div>
            <span className={`role-badge role-badge--${roleModifier}`}>
              {user.role_name || "customer"}
            </span>
          </div>

          <div className="profile-section">
            <dl className="profile-info">
              <div>
                <dt>Full name</dt>
                <dd>{user.full_name || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email || "—"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role_name || "—"}</dd>
              </div>
            </dl>
          </div>

          <form className="profile-section" onSubmit={handleSave}>
            <div className="form-grid">
              <label>
                Full name
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleFieldChange("fullName")}
                  disabled={!isEditing}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFieldChange("email")}
                  disabled={!isEditing}
                  placeholder="Enter email address"
                />
              </label>
              <label>
                Phone
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFieldChange("phone")}
                  disabled={!isEditing}
                />
              </label>
              <label>
                State
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleFieldChange("state")}
                  disabled={!isEditing}
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleFieldChange("city")}
                  disabled={!isEditing}
                />
              </label>
              <label>
                Pincode
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleFieldChange("pincode")}
                  disabled={!isEditing}
                  placeholder="Enter pincode"
                />
              </label>
              <div className="gst-field">
                <label>
                  <span className="gst-label-text">
                    GST number <span className="optional-text">(optional)</span>
                  </span>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleFieldChange("gstNumber")}
                    onFocus={handleGstFieldFocus}
                    onClick={handleGstFieldFocus}
                    disabled={!isEditing}
                    placeholder="Enter GST number"
                  />
                </label>
                <button
                  type="button"
                  className="gst-details-toggle"
                  onClick={toggleGstDetails}
                >
                  {showGstDetails ? "Hide GST & company details" : "Add GST & company details"}
                </button>
              </div>
              <div
                className={`gst-details-panel${
                  showGstDetails ? " gst-details-panel--open" : ""
                }`}
              >
                <div className="gst-details-grid">
                  <label>
                    GST number
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleFieldChange("gstNumber")}
                      disabled={!isEditing}
                    />
                  </label>
                  <label>
                    Company name
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleFieldChange("companyName")}
                      disabled={!isEditing}
                    />
                  </label>
                  <label className="full-width">
                    Company address
                    <textarea
                      name="companyAddress"
                      value={formData.companyAddress}
                      onChange={handleFieldChange("companyAddress")}
                      disabled={!isEditing}
                      rows={3}
                    />
                  </label>
                </div>
              </div>
              <label className="address-field">
                Address
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleFieldChange("address")}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="Enter full address"
                />
              </label>
            </div>

            {status && (
              <p className={`status-message status-message--${status.type}`}>
                {status.message}
              </p>
            )}

            <div className="profile-actions">
              {!isEditing ? (
                <button type="button" className="primary-btn" onClick={handleEditToggle}>
                  Edit profile
                </button>
              ) : (
                <>
                  <button type="button" className="primary-btn" onClick={handleSave}>
                    Save changes
                  </button>
                  <button type="button" className="secondary-btn" onClick={handleCancel}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="profile-footer">
          <button type="button" className="danger-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
