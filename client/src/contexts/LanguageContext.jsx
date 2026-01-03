// client/src/contexts/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  // Load saved language on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('azb_language') || 'en';
    setLanguage(savedLang);
    updateDocumentLanguage(savedLang);
  }, []);

  // Listen for language changes from settings
  useEffect(() => {
    const handleLanguageChange = (event) => {
      const newLang = event.detail;
      setLanguage(newLang);
      updateDocumentLanguage(newLang);
    };

    window.addEventListener('azb-language-changed', handleLanguageChange);
    return () => {
      window.removeEventListener('azb-language-changed', handleLanguageChange);
    };
  }, []);

  // Update document language and direction
  const updateDocumentLanguage = (lang) => {
    document.documentElement.setAttribute('lang', lang);
    // Set text direction: RTL for Urdu, LTR for others
    if (lang === 'ur') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    // Replace parameters if provided
    if (typeof value === 'string' && params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value || key;
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('azb_language', lang);
    updateDocumentLanguage(lang);
    window.dispatchEvent(
      new CustomEvent('azb-language-changed', { detail: lang })
    );
  };

  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

