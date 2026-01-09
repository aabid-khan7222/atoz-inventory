/**
 * Form State Manager Utility
 * 
 * Handles form state persistence with proper clearing on:
 * - Page refresh
 * - Successful form submission
 * 
 * But preserves state during:
 * - Navigation between sections (without refresh)
 */

/**
 * Check if the current page load is a refresh/reload
 * @returns {boolean} True if page was refreshed
 */
export function isPageRefresh() {
  // Check using Performance Navigation API
  if (typeof performance !== 'undefined' && performance.navigation) {
    // performance.navigation.type values:
    // 0: TYPE_NAVIGATE (normal navigation)
    // 1: TYPE_RELOAD (page refresh)
    // 2: TYPE_BACK_FORWARD (back/forward button)
    return performance.navigation.type === 1;
  }
  
  // Fallback: Check using Performance Timeline API (more modern)
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const navType = navEntries[0].type;
      // 'reload' means page was refreshed
      return navType === 'reload';
    }
  }
  
  // If we can't determine, assume it's not a refresh (safer for navigation)
  return false;
}

/**
 * Get saved form state from sessionStorage
 * Automatically clears if page was refreshed or form was submitted
 * @param {string} storageKey - The key used in sessionStorage
 * @returns {object|null} The saved state or null if cleared/not found
 */
export function getFormState(storageKey) {
  // If page was refreshed, clear all form states
  if (isPageRefresh()) {
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(`${storageKey}_submitted`);
    return null;
  }
  
  // Check if form was submitted successfully (should clear on next mount)
  const submittedFlag = sessionStorage.getItem(`${storageKey}_submitted`);
  if (submittedFlag === 'true') {
    // Clear both the state and the submitted flag
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(`${storageKey}_submitted`);
    return null;
  }
  
  // Try to load saved state
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn(`Failed to load saved form state for ${storageKey}:`, e);
    sessionStorage.removeItem(storageKey);
  }
  
  return null;
}

/**
 * Save form state to sessionStorage
 * @param {string} storageKey - The key used in sessionStorage
 * @param {object} state - The state object to save
 */
export function saveFormState(storageKey, state) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    // Clear submitted flag when saving new state
    sessionStorage.removeItem(`${storageKey}_submitted`);
  } catch (e) {
    console.warn(`Failed to save form state for ${storageKey}:`, e);
  }
}

/**
 * Mark form as successfully submitted
 * This will cause the form state to be cleared on next mount
 * @param {string} storageKey - The key used in sessionStorage
 */
export function markFormSubmitted(storageKey) {
  try {
    // Set flag that form was submitted
    sessionStorage.setItem(`${storageKey}_submitted`, 'true');
    // Clear the form state immediately
    sessionStorage.removeItem(storageKey);
  } catch (e) {
    console.warn(`Failed to mark form as submitted for ${storageKey}:`, e);
  }
}

/**
 * Clear form state manually
 * @param {string} storageKey - The key used in sessionStorage
 */
export function clearFormState(storageKey) {
  try {
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(`${storageKey}_submitted`);
  } catch (e) {
    console.warn(`Failed to clear form state for ${storageKey}:`, e);
  }
}

