import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonInput,
  IonText,
  IonIcon
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { close, settings, musicalNotes, images, time } from 'ionicons/icons';
import './PreferencesModal.css';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppPreferences {
  defaultTransitionTime: number;
  pauseOnFocusLoss: boolean;
  autoStartMusic: boolean;
  transitionEffect: string;
  autoAdvanceSlides: boolean;
  showPhotoNames: boolean;
  musicVolume: number;
  rememberLastSlideshow: boolean;
  enableKeyboardShortcuts: boolean;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const [preferences, setPreferences] = useState<AppPreferences>({
    defaultTransitionTime: 5,
    pauseOnFocusLoss: true,
    autoStartMusic: false,
    transitionEffect: 'fade',
    autoAdvanceSlides: true,
    showPhotoNames: false,
    musicVolume: 80,
    rememberLastSlideshow: true,
    enableKeyboardShortcuts: true,
  });

  // Load preferences from storage on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { value: storedPrefs } = await Preferences.get({ key: 'app_preferences' });
        
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs);
          setPreferences(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  // Save preferences to storage
  const savePreferences = async (newPreferences: AppPreferences) => {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ 
        key: 'app_preferences', 
        value: JSON.stringify(newPreferences) 
      });
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const updatePreference = <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  };

  const handleClose = () => {
    onClose();
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose} className="preferences-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonIcon icon={settings} style={{ marginRight: '8px', fontSize: '20px' }} />
            Preferences
          </IonTitle>
          <IonButton 
            slot="end" 
            fill="clear" 
            onClick={handleClose}
            className="preferences-close-btn"
          >
            <IonIcon icon={close} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="preferences-content">
        {/* Slideshow Settings */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={images} style={{ marginRight: '8px' }} />
              Slideshow Settings
            </IonCardTitle>
            <IonCardSubtitle>Configure how your slideshows behave</IonCardSubtitle>
          </IonCardHeader>
          
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>
                  <h3>Default Transition Time</h3>
                  <p>How long each photo is displayed</p>
                </IonLabel>
                <IonSelect
                  value={preferences.defaultTransitionTime}
                  placeholder="Select duration"
                  onIonChange={(e) => updatePreference('defaultTransitionTime', e.detail.value)}
                >
                  <IonSelectOption value={3}>3 seconds</IonSelectOption>
                  <IonSelectOption value={5}>5 seconds</IonSelectOption>
                  <IonSelectOption value={7}>7 seconds</IonSelectOption>
                  <IonSelectOption value={10}>10 seconds</IonSelectOption>
                  <IonSelectOption value={15}>15 seconds</IonSelectOption>
                  <IonSelectOption value={30}>30 seconds</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Transition Effect</h3>
                  <p>Visual effect between photos</p>
                </IonLabel>
                <IonSelect
                  value={preferences.transitionEffect}
                  placeholder="Select effect"
                  onIonChange={(e) => updatePreference('transitionEffect', e.detail.value)}
                >
                  <IonSelectOption value="fade">Fade</IonSelectOption>
                  <IonSelectOption value="slide">Slide</IonSelectOption>
                  <IonSelectOption value="none">None</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Auto-advance slides</h3>
                  <p>Automatically move to next photo</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.autoAdvanceSlides}
                  onIonChange={(e) => updatePreference('autoAdvanceSlides', e.detail.checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Show photo names</h3>
                  <p>Display filename as overlay</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.showPhotoNames}
                  onIonChange={(e) => updatePreference('showPhotoNames', e.detail.checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Pause when window loses focus</h3>
                  <p>Automatically pause slideshow when app is not active</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.pauseOnFocusLoss}
                  onIonChange={(e) => updatePreference('pauseOnFocusLoss', e.detail.checked)}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Music Settings */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={musicalNotes} style={{ marginRight: '8px' }} />
              Music Settings
            </IonCardTitle>
            <IonCardSubtitle>Configure music and audio behavior</IonCardSubtitle>
          </IonCardHeader>
          
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>
                  <h3>Auto-start music with slideshow</h3>
                  <p>Begin playing selected music when slideshow starts</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.autoStartMusic}
                  onIonChange={(e) => updatePreference('autoStartMusic', e.detail.checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Default music volume</h3>
                  <p>Volume level for slideshow playback</p>
                </IonLabel>
                <IonInput
                  type="number"
                  value={preferences.musicVolume}
                  min={0}
                  max={100}
                  placeholder="0-100"
                  onIonInput={(e) => {
                    const value = parseInt(e.detail.value!, 10);
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      updatePreference('musicVolume', value);
                    }
                  }}
                  style={{ textAlign: 'right', maxWidth: '80px' }}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* General Settings */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={settings} style={{ marginRight: '8px' }} />
              General Settings
            </IonCardTitle>
            <IonCardSubtitle>App behavior and interface preferences</IonCardSubtitle>
          </IonCardHeader>
          
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>
                  <h3>Remember last slideshow</h3>
                  <p>Automatically select the most recently used slideshow</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.rememberLastSlideshow}
                  onIonChange={(e) => updatePreference('rememberLastSlideshow', e.detail.checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>Enable keyboard shortcuts</h3>
                  <p>Use keyboard commands to control slideshows</p>
                </IonLabel>
                <IonToggle
                  checked={preferences.enableKeyboardShortcuts}
                  onIonChange={(e) => updatePreference('enableKeyboardShortcuts', e.detail.checked)}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Footer info */}
        <div className="preferences-footer">
          <IonText color="medium">
            <p>Settings are automatically saved. Changes take effect immediately.</p>
          </IonText>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default PreferencesModal;