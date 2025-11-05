/**
 * SlideshowPlayer - Full-screen slideshow player with controls
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  IonModal,
  IonButton,
  IonIcon,
  IonText,
  useIonToast,
  createGesture,
  Gesture,
} from '@ionic/react';
import {
  playOutline,
  pauseOutline,
  closeOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { useSlideshowStore } from '../stores/slideshowStore';
import { keepAwake, allowSleep, preloadNextImages } from '../services/SlideshowService';
import './SlideshowPlayer.css';

const SlideshowPlayer: React.FC = () => {
  const {
    showPlayer,
    isPlaying,
    isPaused,
    currentIndex,
    photos,
    config,
    pause,
    resume,
    stop,
    next,
    previous,
  } = useSlideshowStore();

  const [showControls, setShowControls] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(config.transitionTime);
  const [presentToast] = useIonToast();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);

  // Current photo
  const currentPhoto = photos[currentIndex];

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Toggle controls on tap
  const handleTap = () => {
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
    resetControlsTimeout();
  };

  // Handle stop/exit
  const handleStop = async () => {
    stop();
    await allowSleep();
  };

  // Handle next photo
  const handleNext = useCallback(() => {
    next();
    setTimeRemaining(config.transitionTime);
    resetControlsTimeout();
  }, [next, config.transitionTime, resetControlsTimeout]);

  // Handle previous photo
  const handlePrevious = useCallback(() => {
    previous();
    setTimeRemaining(config.transitionTime);
    resetControlsTimeout();
  }, [previous, config.transitionTime, resetControlsTimeout]);

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    useSlideshowStore.getState().updateConfig({ transitionTime: speed });
    setTimeRemaining(speed);
    resetControlsTimeout();
    
    presentToast({
      message: `Transition speed: ${speed}s`,
      duration: 1500,
      position: 'top',
      color: 'dark',
    });
  };

  // Timer for auto-advance
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            next();
            return config.transitionTime;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, isPaused, config.transitionTime, next]);

  // Keep screen awake when playing
  useEffect(() => {
    if (showPlayer && isPlaying) {
      keepAwake();
    } else if (showPlayer && isPaused) {
      // Keep awake even when paused
      keepAwake();
    }

    return () => {
      if (!showPlayer) {
        allowSleep();
      }
    };
  }, [showPlayer, isPlaying, isPaused]);

  // Preload next images
  useEffect(() => {
    if (photos.length > 0) {
      preloadNextImages(photos, currentIndex, 2);
    }
  }, [currentIndex, photos]);

  // Setup swipe gestures
  useEffect(() => {
    if (!imageContainerRef.current) return;

    const gesture = createGesture({
      el: imageContainerRef.current,
      gestureName: 'swipe',
      threshold: 15,
      onEnd: (detail) => {
        const deltaX = detail.deltaX;
        
        // Swipe left = next
        if (deltaX < -50) {
          handleNext();
        }
        // Swipe right = previous
        else if (deltaX > 50) {
          handlePrevious();
        }
      },
    });

    gesture.enable();
    gestureRef.current = gesture;

    return () => {
      gesture.destroy();
    };
  }, [currentIndex, photos.length, config.loop, handleNext, handlePrevious]);

  // Show controls when paused
  useEffect(() => {
    if (isPaused) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!currentPhoto) {
    return null;
  }

  return (
    <IonModal
      isOpen={showPlayer}
      onDidDismiss={handleStop}
      className="slideshow-modal"
    >
      <div className="slideshow-container">
        {/* Photo Display */}
        <div
          ref={imageContainerRef}
          className="slideshow-image-container"
          onClick={handleTap}
        >
          <img
            src={currentPhoto.uri}
            alt={currentPhoto.filename}
            className="slideshow-image"
          />
        </div>

        {/* Controls Overlay */}
        <div className={`slideshow-controls ${showControls ? 'visible' : 'hidden'}`}>
          {/* Progress Indicator */}
          <div className="slideshow-progress">
            <IonText>
              <span className="progress-text">
                {currentIndex + 1} / {photos.length}
              </span>
            </IonText>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${((config.transitionTime - timeRemaining) / config.transitionTime) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="slideshow-buttons">
            {/* Previous */}
            <IonButton
              fill="clear"
              onClick={handlePrevious}
              disabled={currentIndex === 0 && !config.loop}
              className="control-button"
            >
              <IonIcon icon={chevronBackOutline} />
            </IonButton>

            {/* Play/Pause */}
            <IonButton
              fill="solid"
              onClick={handlePlayPause}
              className="control-button play-button"
            >
              <IonIcon icon={isPlaying ? pauseOutline : playOutline} />
            </IonButton>

            {/* Next */}
            <IonButton
              fill="clear"
              onClick={handleNext}
              disabled={currentIndex === photos.length - 1 && !config.loop}
              className="control-button"
            >
              <IonIcon icon={chevronForwardOutline} />
            </IonButton>
          </div>

          {/* Speed Controls */}
          <div className="slideshow-speed">
            <IonText color="light">
              <span className="speed-label">Speed:</span>
            </IonText>
            {[2, 3, 5, 10].map((speed) => (
              <IonButton
                key={speed}
                fill={config.transitionTime === speed ? 'solid' : 'outline'}
                size="small"
                onClick={() => handleSpeedChange(speed)}
                className="speed-button"
              >
                {speed}s
              </IonButton>
            ))}
          </div>

          {/* Exit Button */}
          <IonButton
            fill="clear"
            onClick={handleStop}
            className="exit-button"
          >
            <IonIcon icon={closeOutline} />
          </IonButton>
        </div>
      </div>
    </IonModal>
  );
};

export default SlideshowPlayer;
