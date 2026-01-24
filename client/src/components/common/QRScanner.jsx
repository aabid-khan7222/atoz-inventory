import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './QRScanner.css';

const QRScanner = ({ isOpen, onClose, onScan, onError }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !html5QrCodeRef.current) {
      startScanning();
    } else if (!isOpen && html5QrCodeRef.current) {
      stopScanning();
    }

    return () => {
      if (html5QrCodeRef.current) {
        stopScanning();
      }
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError('');
      setIsScanning(true);

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        // Use the first available camera (usually the back camera on mobile)
        const cameraId = devices[0].id;
        
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Successfully scanned
            handleScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Ignore scanning errors (they're frequent while looking for QR codes)
            // Only show errors if they're not "NotFoundException" (which is normal)
            if (errorMessage && !errorMessage.includes('NotFoundException')) {
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

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
      setIsScanning(false);
      setError('');
    } catch (err) {
      console.error('Error stopping QR scanner:', err);
    }
  };

  const handleScanSuccess = (decodedText) => {
    // Stop scanning immediately after successful scan
    stopScanning();
    
    // Call the onScan callback with the scanned text
    if (onScan) {
      onScan(decodedText.trim());
    }
    
    // Close the scanner
    if (onClose) {
      onClose();
    }
  };

  const handleClose = () => {
    stopScanning();
    if (onClose) {
      onClose();
    }
  };

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
          {error ? (
            <div className="qr-scanner-error">
              <p>{error}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={startScanning}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div id="qr-reader" className="qr-reader-container"></div>
              {isScanning && (
                <p className="qr-scanner-hint">
                  Point your camera at the QR code
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
