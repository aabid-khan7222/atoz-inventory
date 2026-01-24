import React, { useEffect, useRef, useState } from 'react';
import './QRScanner.css';

// Dynamic import for html5-qrcode to ensure it loads correctly
let Html5Qrcode = null;

const QRScanner = ({ isOpen, onClose, onScan, onError, continuousMode = false, onNextField, currentFieldIndex, totalFields }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const scanCooldownRef = useRef(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState('');
  const successTimeoutRef = useRef(null);
  const currentFieldIndexRef = useRef(currentFieldIndex);
  
  // Keep ref in sync with prop
  useEffect(() => {
    currentFieldIndexRef.current = currentFieldIndex;
  }, [currentFieldIndex]);

  // Load the library when component mounts
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        if (!Html5Qrcode) {
          const html5QrcodeModule = await import('html5-qrcode');
          Html5Qrcode = html5QrcodeModule.Html5Qrcode;
          setLibraryLoaded(true);
        } else {
          setLibraryLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load html5-qrcode library:', err);
        setError('Failed to load QR scanner library. Please refresh the page.');
        if (onError) {
          onError(err);
        }
      }
    };
    
    loadLibrary();
  }, [onError]);

  useEffect(() => {
    if (isOpen && !html5QrCodeRef.current && libraryLoaded) {
      startScanning();
    } else if (!isOpen && html5QrCodeRef.current) {
      stopScanning();
    }

    return () => {
      if (html5QrCodeRef.current) {
        stopScanning();
      }
    };
  }, [isOpen, libraryLoaded]);

  // Find back camera (preferred for QR scanning)
  const findBackCamera = (devices) => {
    if (!devices || devices.length === 0) return 0;
    
    // Try to find back camera by label
    const backCameraIndex = devices.findIndex(device => {
      const label = device.label.toLowerCase();
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             (device.facingMode && device.facingMode === 'environment');
    });
    
    // If back camera found, use it; otherwise use first camera
    return backCameraIndex >= 0 ? backCameraIndex : 0;
  };

  const startScanning = async (cameraIndex = null) => {
    try {
      // Ensure library is loaded
      if (!Html5Qrcode) {
        const html5QrcodeModule = await import('html5-qrcode');
        Html5Qrcode = html5QrcodeModule.Html5Qrcode;
      }

      if (!Html5Qrcode) {
        throw new Error('QR scanner library not loaded. Please refresh the page.');
      }

      setError('');
      setIsScanning(true);

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setAvailableCameras(devices);
        
        // Determine which camera to use
        let selectedIndex;
        if (cameraIndex !== null) {
          selectedIndex = cameraIndex;
        } else {
          // First time: try to find back camera
          selectedIndex = findBackCamera(devices);
        }
        
        // Ensure index is valid
        selectedIndex = Math.min(selectedIndex, devices.length - 1);
        setCurrentCameraIndex(selectedIndex);
        
        const cameraId = devices[selectedIndex].id;
        setCurrentCameraId(cameraId);
        
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          (decodedText) => {
            // Successfully scanned - handle it
            handleScanSuccess(decodedText);
            // In continuous mode, scanner keeps running - don't stop it
          },
          (errorMessage) => {
            // Ignore scanning errors (they're frequent while looking for QR codes)
            // Only show errors if they're not "NotFoundException" (which is normal)
            if (errorMessage && !errorMessage.includes('NotFoundException') && !errorMessage.includes('No QR code found')) {
              // Don't show every error, just log it
              console.debug('QR scan error:', errorMessage);
            }
          }
        );
      } else {
        throw new Error('No camera found. Please ensure your device has a camera and grant camera permissions.');
      }
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      setError(err.message || 'Failed to start camera. Please check camera permissions.');
      setIsScanning(false);
      if (onError) {
        onError(err);
      }
    }
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) {
      return; // Can't switch if only one camera
    }
    
    try {
      // Stop current camera
      await stopScanning();
      
      // Switch to next camera
      const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
      
      // Small delay to ensure camera is fully stopped
      setTimeout(() => {
        startScanning(nextIndex);
      }, 300);
    } catch (err) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
      setIsScanning(false);
      setError('');
      // Don't clear cameras list, keep it for switching
    } catch (err) {
      console.error('Error stopping QR scanner:', err);
    }
  };

  // Play success sound
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (err) {
      console.debug('Could not play success sound:', err);
    }
  };

  const handleScanSuccess = (decodedText) => {
    // Prevent multiple rapid scans
    if (scanCooldownRef.current) {
      return;
    }
    
    scanCooldownRef.current = true;
    
    // Play success sound
    playSuccessSound();
    
    // Show success message - use ref to get latest value
    const currentIndex = currentFieldIndexRef.current;
    const fieldNum = currentIndex !== null && currentIndex !== undefined 
      ? currentIndex + 1 
      : '';
    const totalNum = totalFields || '';
    setScanSuccessMessage(`✓ Serial number ${fieldNum}${totalNum ? ` of ${totalNum}` : ''} scanned!`);
    
    // Clear success message after 1.5 seconds
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setScanSuccessMessage('');
    }, 1500);
    
    // Call the onScan callback with the scanned text
    if (onScan) {
      onScan(decodedText.trim());
    }
    
    if (continuousMode) {
      // In continuous mode, keep scanner open and move to next field
      // Don't stop scanning or close scanner
      if (onNextField) {
        // Call onNextField immediately - the parent will handle state updates
        // Small delay to allow current scan to process and show feedback
        setTimeout(() => {
          onNextField();
          // Reset cooldown after a longer delay to allow next scan
          setTimeout(() => {
            scanCooldownRef.current = false;
          }, 1000);
        }, 400);
      } else {
        // Reset cooldown if no next field callback
        setTimeout(() => {
          scanCooldownRef.current = false;
        }, 1000);
      }
    } else {
      // Normal mode: stop scanning and close
      stopScanning();
      if (onClose) {
        onClose();
      }
      scanCooldownRef.current = false;
    }
  };

  const handleClose = () => {
    stopScanning();
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setScanSuccessMessage('');
    if (onClose) {
      onClose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="qr-scanner-overlay" onClick={handleClose}>
      <div className="qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-scanner-header">
          <h3>Scan QR Code</h3>
          <button
            type="button"
            className="qr-scanner-close"
            onClick={handleClose}
            aria-label="Close scanner"
          >
            ×
          </button>
        </div>
        
        <div className="qr-scanner-content">
          {!libraryLoaded && !error ? (
            <div className="qr-scanner-error">
              <p>Loading QR scanner...</p>
            </div>
          ) : error ? (
            <div className="qr-scanner-error">
              <p>{error}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => startScanning()}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div id="qr-reader" className="qr-reader-container"></div>
              {scanSuccessMessage && (
                <div className="qr-scanner-success-message">
                  {scanSuccessMessage}
                </div>
              )}
              {isScanning && (
                <>
                  <p className="qr-scanner-hint">
                    {continuousMode 
                      ? (currentFieldIndexRef.current !== null && currentFieldIndexRef.current !== undefined && totalFields
                          ? `Scanning serial number ${currentFieldIndexRef.current + 1} of ${totalFields}. Scanner will move to next field automatically.`
                          : 'Scan QR codes continuously. Scanner will move to next field automatically.')
                      : 'Point your camera at the QR code'}
                  </p>
                  {availableCameras.length > 1 && (
                    <button
                      type="button"
                      className="qr-scanner-flip-button"
                      onClick={switchCamera}
                      title="Switch Camera"
                      aria-label="Switch between front and back camera"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 7H21C22.1046 7 23 7.89543 23 9V20C23 21.1046 22.1046 22 21 22H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 1L20 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M20 5H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M8 15L4 19L8 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4 19H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>Flip Camera</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
