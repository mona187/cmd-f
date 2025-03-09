import '@mediapipe/hands';
import * as handpose from '@tensorflow-models/handpose';
import * as tf from '@tensorflow/tfjs';
import React, { useCallback, useEffect, useRef } from 'react';

// Throttle function to limit detection frequency
const throttle = (fn, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

// Gesture history to track recent detections
const GESTURE_HISTORY_SIZE = 5;
const GESTURE_HISTORY = {
  signs: [],
  timestamps: [],
  add(sign, timestamp) {
    this.signs.push(sign);
    this.timestamps.push(timestamp);
    if (this.signs.length > GESTURE_HISTORY_SIZE) {
      this.signs.shift();
      this.timestamps.shift();
    }
  },
  clear() {
    this.signs = [];
    this.timestamps = [];
  },
  getMostFrequentSign() {
    if (this.signs.length === 0) return null;
    
    const signCounts = {};
    this.signs.forEach(sign => {
      signCounts[sign] = (signCounts[sign] || 0) + 1;
    });
    
    let maxCount = 0;
    let mostFrequentSign = null;
    
    Object.entries(signCounts).forEach(([sign, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentSign = sign;
      }
    });
    
    return mostFrequentSign;
  }
};

const SignLanguageRecognition = ({ 
  videoRef, 
  onSignDetected, 
  targetLang,
  isActive,
  onActiveChange,
  KawaiiGhost = null
}) => {
  const canvasRef = useRef(null);
  const handposeModelRef = useRef(null);
  const requestAnimationFrameRef = useRef(null);
  const lastDetectedSignRef = useRef('');
  const lastDetectionTimeRef = useRef(0);
  const detectionCountRef = useRef(0);
  const MIN_DETECTION_INTERVAL = 1500;
  const MIN_DETECTION_COUNT = 4;
  const DETECTION_THRESHOLD = 60;
  const HORIZONTAL_THRESHOLD = 120;
  const DETECTION_FPS = 10;
  const DETECTION_INTERVAL = 1000 / DETECTION_FPS;

  // Load the handpose model
  useEffect(() => {
    const loadHandposeModel = async () => {
      try {
        console.log('Starting to load TensorFlow.js and handpose model...');
        
        if (!tf) {
          console.error('TensorFlow.js not loaded!');
          return;
        }
        console.log('TensorFlow.js loaded, backend:', await tf.ready());
        
        console.log('Loading handpose model...');
        const model = await handpose.load({
          maxHands: 1,
          modelType: 'lite'
        });
        
        handposeModelRef.current = model;
        console.log('Handpose model loaded successfully!');
      } catch (err) {
        console.error('Failed to load handpose model:', err);
        alert('Error loading hand detection model. Please check console for details.');
      }
    };

    const timeoutId = setTimeout(() => {
      if (!handposeModelRef.current) {
        console.error('Model loading timed out after 30 seconds');
        alert('Hand detection model loading timed out. Please refresh the page.');
      }
    }, 30000);

    loadHandposeModel();

    return () => clearTimeout(timeoutId);
  }, []);

  // Function to draw hand landmarks on canvas
  const drawHand = useCallback((predictions, ctx) => {
    if (!predictions.length) return;

    predictions.forEach(prediction => {
      const landmarks = prediction.landmarks;

      // Draw dots
      landmarks.forEach(([x, y, z]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 3 * Math.PI);
        ctx.fillStyle = '#4a90e2';
        ctx.fill();
      });

      // Draw lines connecting landmarks
      const palmBase = landmarks[0];
      const thumb = landmarks.slice(1, 5);
      const indexFinger = landmarks.slice(5, 9);
      const middleFinger = landmarks.slice(9, 13);
      const ringFinger = landmarks.slice(13, 17);
      const pinky = landmarks.slice(17, 21);

      [thumb, indexFinger, middleFinger, ringFinger, pinky].forEach(finger => {
        ctx.beginPath();
        ctx.moveTo(palmBase[0], palmBase[1]);
        finger.forEach(([x, y]) => {
          ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  }, []);

  // Function to interpret hand gestures with improved thresholds
  const interpretHandGesture = useCallback((landmarks) => {
    const palmBase = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const isFingerUp = (fingerTip) => {
      const verticalDiff = palmBase[1] - fingerTip[1];
      const horizontalDiff = Math.abs(palmBase[0] - fingerTip[0]);
      return verticalDiff > DETECTION_THRESHOLD && horizontalDiff < HORIZONTAL_THRESHOLD;
    };

    const isThumbUp = isFingerUp(thumbTip);
    const isIndexUp = isFingerUp(indexTip);
    const isMiddleUp = isFingerUp(middleTip);
    const isRingUp = isFingerUp(ringTip);
    const isPinkyUp = isFingerUp(pinkyTip);

    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return "Yes";
    if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return "One";
    if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) return "Two";
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && !isPinkyUp) return "Three";
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) return "Hello";
    if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) return "Rock";

    return "";
  }, [DETECTION_THRESHOLD, HORIZONTAL_THRESHOLD]);

  // Function to detect hand signs with throttling and state management
  const detectHandSigns = useCallback(async (video) => {
    if (!handposeModelRef.current || !video) return;

    try {
      const canvas = canvasRef.current;
      const inferenceWidth = 320;
      const inferenceHeight = 240;
      canvas.width = inferenceWidth;
      canvas.height = inferenceHeight;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await handposeModelRef.current.estimateHands(canvas, {
        flipHorizontal: true
      });
      
      if (predictions.length > 0) {
        drawHand(predictions, ctx);
        const landmarks = predictions[0].landmarks;
        const sign = interpretHandGesture(landmarks);
        
        const currentTime = Date.now();
        
        if (sign) {
          if (currentTime - lastDetectionTimeRef.current >= MIN_DETECTION_INTERVAL) {
            if (sign === lastDetectedSignRef.current) {
              detectionCountRef.current++;
              console.log(`Detection count for ${sign}: ${detectionCountRef.current}`);
              
              if (detectionCountRef.current >= MIN_DETECTION_COUNT) {
                console.log(`Sign detected: ${sign}`);
                onSignDetected(sign);
                lastDetectionTimeRef.current = currentTime;
                detectionCountRef.current = 0;
              }
            } else {
              console.log(`New sign detected: ${sign}`);
              detectionCountRef.current = 1;
              lastDetectedSignRef.current = sign;
            }
          }
        } else {
          if (lastDetectedSignRef.current) {
            console.log('No sign detected, resetting counters');
            detectionCountRef.current = 0;
            lastDetectedSignRef.current = '';
          }
        }
      } else {
        if (lastDetectedSignRef.current) {
          console.log('No hand detected, resetting counters');
          detectionCountRef.current = 0;
          lastDetectedSignRef.current = '';
        }
      }
    } catch (err) {
      console.error('Hand detection error:', err);
    }
  }, [drawHand, interpretHandGesture, MIN_DETECTION_INTERVAL, MIN_DETECTION_COUNT, onSignDetected]);

  // Throttled version of detection
  const throttledDetect = useCallback(
    throttle(detectHandSigns, DETECTION_INTERVAL),
    [detectHandSigns, DETECTION_INTERVAL]
  );

  // Detection loop with proper frame management
  const detectLoop = useCallback(async (video) => {
    if (!isActive) return;
    
    await throttledDetect(video);
    requestAnimationFrameRef.current = requestAnimationFrame(() => detectLoop(video));
  }, [isActive, throttledDetect]);

  // Start/Stop detection effect
  useEffect(() => {
    if (isActive) {
      if (!handposeModelRef.current) {
        console.error('Handpose model not loaded yet!');
        alert('Please wait for the hand detection model to load...');
        return;
      }
      
      if (videoRef.current) {
        console.log('Starting hand detection with video:', videoRef.current);
        detectLoop(videoRef.current);
      } else {
        console.error('No video reference available!');
      }
    } else {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
      detectionCountRef.current = 0;
      lastDetectedSignRef.current = '';
      lastDetectionTimeRef.current = 0;
      GESTURE_HISTORY.clear();
    }

    return () => {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    };
  }, [isActive, videoRef, detectLoop]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)'
        }}
      />
      <button 
        onClick={() => onActiveChange(!isActive)}
        style={{ 
          position: 'absolute',
          bottom: '4rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: isActive ? '#ff4444' : '#0066ff',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'translateX(-50%) scale(1.05)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'translateX(-50%)';
        }}
      >
        {KawaiiGhost && typeof KawaiiGhost === 'function' && (
          <KawaiiGhost style={{ width: '20px', height: '20px' }} />
        )}
        {isActive ? 'Stop Detection' : 'Start Detection'}
      </button>
    </>
  );
};

export default SignLanguageRecognition; 