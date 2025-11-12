/**
 * SlideshowPlayer - Full-screen slideshow player with controls
 * Updated to work with SavedSlideshow from library
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  IonModal,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
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
  musicalNotesOutline,
  exitOutline,
} from 'ionicons/icons';
import { SavedSlideshow } from '../types/slideshow';
import { Photo } from '../types';
import { usePlaylistLibraryStore } from '../stores/playlistLibraryStore';
import { useSlideshowLibraryStore } from '../stores/slideshowLibraryStore';
import { useMusicStore } from '../stores/musicStore';
import { keepAwake, allowSleep, preloadNextImages } from '../services/SlideshowService';
import * as MusicPlayerService from '../services/MusicPlayerService';
import * as HapticService from '../services/HapticService';
import './SlideshowPlayer.css';

interface SlideshowPlayerProps {
  slideshow: SavedSlideshow | null;
  isOpen: boolean;
  onClose: () => void;
}

const SlideshowPlayer: React.FC<SlideshowPlayerProps> = ({ slideshow, isOpen, onClose }) => {
  const { playlists: customPlaylists } = usePlaylistLibraryStore();
  const { recordPlay } = useSlideshowLibraryStore();
  const { playlists: spotifyPlaylists } = useMusicStore();

  // Local playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [transitionTime, setTransitionTime] = useState(5);
  const [currentTrack, setCurrentTrack] = useState<{
    name: string;
    artists: string[];
    album: string;
    imageUrl: string;
  } | null>(null);
  const [isMusicPlaying, setMusicPlaying] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [musicInitialized, setMusicInitialized] = useState(false);
  const [presentToast] = useIonToast();

  // Initialize slideshow from SavedSlideshow
  useEffect(() => {
    if (isOpen && slideshow) {
      // Use photos directly from slideshow
      const slideshowPhotos = slideshow.photos || [];

      // Shuffle if needed
      const orderedPhotos = slideshow.settings.shuffle
        ? [...slideshowPhotos].sort(() => Math.random() - 0.5)
        : slideshowPhotos;

      setPhotos(orderedPhotos);
      setTransitionTime(slideshow.settings.transitionTime);
      setTimeRemaining(slideshow.settings.transitionTime);
      setCurrentIndex(0);
      setIsPlaying(true);
      setIsPaused(false);
      setMusicInitialized(false);
      setShowControls(true);
      
      // Start auto-hide timer for controls
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isOpen, slideshow]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const trackUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Current photo
  const currentPhoto = photos[currentIndex];

  // Initialize music player when slideshow opens
  useEffect(() => {
    const initMusic = async () => {
      if (isOpen && slideshow && !musicInitialized) {
        const { musicSource } = slideshow;
        
        console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
          timestamp: Date.now(),
          action: 'music_init_start',
          slideshowId: slideshow.id,
          slideshowName: slideshow.name,
          musicSourceType: musicSource.type,
          musicSourceId: musicSource.type !== 'none' ? musicSource.playlistId : null,
        }));
        
        // If no music is selected, skip initialization and allow slideshow to play
        if (musicSource.type === 'none') {
          console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
            timestamp: Date.now(),
            action: 'music_init_skipped',
            reason: 'no_music_source',
          }));
          setMusicInitialized(true);
          return;
        }

        try {
          setMusicError(null);
          
          await MusicPlayerService.initializePlayer(
            // On state change
            async (state) => {
              if (state && state.track_window?.current_track) {
                const track = state.track_window.current_track;
                setCurrentTrack({
                  name: track.name,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  artists: track.artists.map((a: any) => a.name),
                  album: track.album.name,
                  imageUrl: track.album.images[0]?.url || '',
                });
                setMusicPlaying(!state.paused);
              }
            },
            // On error
            (error) => {
              setMusicError(error);
              presentToast({
                message: `Music error: ${error}. Slideshow will continue without music.`,
                duration: 4000,
                color: 'warning',
                position: 'top',
              });
            }
          );

          // Start playback based on music source type
          if (musicSource.type === 'custom-playlist') {
            const playlist = customPlaylists.find(p => p.id === musicSource.playlistId);
            if (playlist && playlist.tracks.length > 0) {
              console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
                timestamp: Date.now(),
                action: 'starting_playback',
                playlistType: 'custom',
                playlistName: playlist.name,
                trackCount: playlist.tracks.length,
              }));
              // Play all tracks in the custom playlist
              const trackUris = playlist.tracks.map(track => track.uri);
              await MusicPlayerService.startPlayback(trackUris, false);
              setMusicPlaying(true);
            } else {
              console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
                timestamp: Date.now(),
                action: 'playlist_not_found',
                playlistType: 'custom',
                playlistId: musicSource.playlistId,
              }));
            }
          } else if (musicSource.type === 'spotify-playlist') {
            const playlist = spotifyPlaylists.find(p => p.id === musicSource.playlistId);
            if (playlist) {
              console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
                timestamp: Date.now(),
                action: 'starting_playback',
                playlistType: 'spotify',
                playlistName: playlist.name,
                playlistUri: playlist.uri,
              }));
              await MusicPlayerService.startPlayback(playlist.uri, true);
              setMusicPlaying(true);
            } else {
              console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
                timestamp: Date.now(),
                action: 'playlist_not_found',
                playlistType: 'spotify',
                playlistId: musicSource.playlistId,
              }));
            }
          }
          
          console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
            timestamp: Date.now(),
            action: 'music_init_success',
            slideshowId: slideshow.id,
          }));
        } catch (error) {
          console.error('Failed to initialize music:', error);
          const errorMsg = error instanceof Error ? error.message : 'Failed to start music';
          setMusicError(errorMsg);
          
          console.log('[SlideshowPlayer:MusicInit]', JSON.stringify({
            timestamp: Date.now(),
            action: 'music_init_error',
            error: errorMsg,
            slideshowId: slideshow.id,
            musicSourceType: musicSource.type,
          }));
          
          // Show toast with specific music error message
          presentToast({
            message: `Music error: ${errorMsg}. Slideshow will continue without music.`,
            duration: 4000,
            color: 'warning',
            position: 'top',
          });
        } finally {
          // Always set musicInitialized to true so the slideshow can play
          setMusicInitialized(true);
        }
      }
    };

    initMusic();
  }, [isOpen, slideshow, musicInitialized, customPlaylists, spotifyPlaylists, presentToast]);

  // Update current track info periodically
  useEffect(() => {
    if (isOpen && isMusicPlaying) {
      trackUpdateIntervalRef.current = setInterval(async () => {
        const trackInfo = await MusicPlayerService.getCurrentTrack();
        if (trackInfo) {
          setCurrentTrack(trackInfo);
        }
      }, 5000); // Update every 5 seconds
    }

    return () => {
      if (trackUpdateIntervalRef.current) {
        clearInterval(trackUpdateIntervalRef.current);
      }
    };
  }, [isOpen, isMusicPlaying]);

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

  // Hide controls (X button)
  const handleHideControls = async () => {
    await HapticService.impactLight();
    setShowControls(false);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  // Handle play/pause
  const handlePlayPause = async () => {
    await HapticService.impactMedium();
    if (isPlaying) {
      setIsPlaying(false);
      setIsPaused(true);
      // Pause music
      try {
        await MusicPlayerService.pausePlayback();
        setMusicPlaying(false);
      } catch (error) {
        console.error('Failed to pause music:', error);
      }
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      // Resume music
      try {
        await MusicPlayerService.resumePlayback();
        setMusicPlaying(true);
      } catch (error) {
        console.error('Failed to resume music:', error);
      }
    }
    resetControlsTimeout();
  };

  // Handle stop/exit
  const handleStop = async () => {
    await HapticService.impactLight();
    
    // Update play count in library
    if (slideshow) {
      await recordPlay(slideshow.id);
    }
    
    // Reset local state
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setMusicInitialized(false);
    
    await allowSleep();
    
    // Stop music and cleanup
    try {
      await MusicPlayerService.stopPlayback();
      MusicPlayerService.cleanup();
      setMusicPlaying(false);
      setCurrentTrack(null);
      setMusicInitialized(false);
    } catch (error) {
      console.error('Failed to stop music:', error);
    }
    
    // Call parent's onClose callback
    onClose();
  };

  // Handle next photo
  const handleNext = useCallback(async (isManual: boolean = true) => {
    if (isManual) {
      await HapticService.impactLight();
    }
    
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;
      
      // Check if we've reached the end
      if (nextIndex >= photos.length) {
        // If loop is enabled, restart from beginning
        if (slideshow?.settings.loop) {
          // If shuffle is also enabled, re-shuffle the photos for a fresh experience
          if (slideshow?.settings.shuffle && slideshow.photos) {
            const reshuffled = [...slideshow.photos].sort(() => Math.random() - 0.5);
            setPhotos(reshuffled);
          }
          return 0; // Start from first photo
        } else {
          // If not looping, pause at the last photo
          setIsPlaying(false);
          setIsPaused(true);
          return prev; // Stay at current photo
        }
      }
      
      return nextIndex;
    });
    
    setTimeRemaining(transitionTime);
    if (isManual) {
      resetControlsTimeout();
    }
  }, [photos.length, transitionTime, resetControlsTimeout, slideshow]);

  // Handle previous photo
  const handlePrevious = useCallback(async () => {
    await HapticService.impactLight();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setTimeRemaining(transitionTime);
    resetControlsTimeout();
  }, [photos.length, transitionTime, resetControlsTimeout]);

  // Handle speed change
  const handleSpeedChange = async (speed: number) => {
    await HapticService.impactLight();
    setTransitionTime(speed);
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
            // Auto-advance - don't show controls
            handleNext(false);
            return transitionTime;
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
  }, [isPlaying, isPaused, transitionTime, handleNext]);

  // Keep screen awake when playing
  useEffect(() => {
    if (isOpen && isPlaying) {
      keepAwake();
    } else if (isOpen && isPaused) {
      // Keep awake even when paused
      keepAwake();
    }

    return () => {
      if (!isOpen) {
        allowSleep();
      }
    };
  }, [isOpen, isPlaying, isPaused]);

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
        
        // Swipe left = next (manual)
        if (deltaX < -50) {
          handleNext(true);
        }
        // Swipe right = previous (manual)
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
  }, [handleNext, handlePrevious]);

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
      isOpen={isOpen}
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

        {/* Music Loading Overlay */}
        {!musicInitialized && (
          <div className="music-loading-overlay">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Initializing music player...</p>
            </IonText>
          </div>
        )}

        {/* Controls Overlay */}
        <div className={`slideshow-controls ${showControls ? 'visible' : 'hidden'}`}>
          {/* Now Playing */}
          {currentTrack && (
            <div className="now-playing">
              <IonIcon icon={musicalNotesOutline} className="now-playing-icon" />
              <div className="now-playing-info">
                <IonText>
                  <p className="now-playing-track">{currentTrack.name}</p>
                </IonText>
                <IonText color="medium">
                  <p className="now-playing-artist">{currentTrack.artists.join(', ')}</p>
                </IonText>
              </div>
            </div>
          )}

          {/* Music Error */}
          {musicError && !currentTrack && (
            <div className="music-error">
              <IonText color="warning">
                <p>{musicError}</p>
              </IonText>
            </div>
          )}

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
                  width: `${((transitionTime - timeRemaining) / transitionTime) * 100}%`,
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
              disabled={currentIndex === 0 && !slideshow?.settings.loop}
              className="control-button"
              aria-label="Previous photo"
            >
              <IonIcon icon={chevronBackOutline} />
            </IonButton>

            {/* Play/Pause */}
            <IonButton
              fill="solid"
              onClick={handlePlayPause}
              className="control-button play-button"
              aria-label={isPlaying ? 'Pause slideshow' : 'Resume slideshow'}
            >
              <IonIcon icon={isPlaying ? pauseOutline : playOutline} />
            </IonButton>

            {/* Next */}
            <IonButton
              fill="clear"
              onClick={() => handleNext(true)}
              disabled={currentIndex === photos.length - 1 && !slideshow?.settings.loop}
              className="control-button"
              aria-label="Next photo"
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
                fill={transitionTime === speed ? 'solid' : 'outline'}
                size="small"
                onClick={() => handleSpeedChange(speed)}
                className="speed-button"
                aria-label={
                  `Set transition speed to ${speed} seconds` +
                  (transitionTime === speed ? ', currently selected' : '')
                }
              >
                {speed}s
              </IonButton>
            ))}
          </div>

          {/* Control Buttons Row */}
          <div className="slideshow-control-buttons">
            {/* Hide Controls Button (X) */}
            <IonButton
              fill="clear"
              onClick={handleHideControls}
              className="hide-controls-button"
              aria-label="Hide controls"
            >
              <IonIcon icon={closeOutline} />
            </IonButton>

            {/* Exit Slideshow Button */}
            <IonButton
              fill="clear"
              onClick={handleStop}
              className="exit-button"
              aria-label="Exit slideshow"
            >
              <IonIcon icon={exitOutline} />
              <span className="exit-text">Exit</span>
            </IonButton>
          </div>
        </div>
      </div>
    </IonModal>
  );
};

export default SlideshowPlayer;
