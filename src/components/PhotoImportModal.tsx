/**
 * PhotoImportModal - Modal for importing photos with progress feedback
 * Shows progress during bulk photo import with thumbnail generation and duplicate detection
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonText,
  IonProgressBar,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonBadge,
} from '@ionic/react';
import { close, checkmarkCircle, alertCircle, duplicate } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { PhotoImportResult } from '../types';
import './PhotoImportModal.css';

interface PhotoImportModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onComplete?: (result: PhotoImportResult) => void;
  importResult: PhotoImportResult | null;
  isImporting: boolean;
  currentFile?: string;
  progress?: number;
}

/**
 * PhotoImportModal Component
 * Displays import progress and results with detailed statistics
 */
const PhotoImportModal: React.FC<PhotoImportModalProps> = ({
  isOpen,
  onDismiss,
  onComplete,
  importResult,
  isImporting,
  currentFile,
  progress = 0,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowDetails(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-call onComplete when import finishes successfully
    if (importResult && importResult.success && !isImporting && onComplete) {
      const timer = setTimeout(() => {
        onComplete(importResult);
      }, 1500); // Small delay to show success state
      
      return () => clearTimeout(timer);
    }
  }, [importResult, isImporting, onComplete]);

  const handleDismiss = () => {
    if (!isImporting) {
      onDismiss();
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss} backdropDismiss={!isImporting}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {isImporting ? 'Importing Photos...' : 'Import Complete'}
          </IonTitle>
          {!isImporting && (
            <IonButtons slot="end">
              <IonButton onClick={handleDismiss}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="photo-import-content">
        <div className="photo-import-container">
          {/* Importing State */}
          {isImporting && (
            <>
              <div className="import-progress-section">
                <IonSpinner name="crescent" className="import-spinner" />
                <IonText color="medium">
                  <p className="import-status">Processing photos...</p>
                  {currentFile && (
                    <p className="import-current-file">{currentFile}</p>
                  )}
                </IonText>
                <IonProgressBar value={progress} className="import-progress-bar" />
                {progress > 0 && (
                  <IonText color="medium">
                    <p className="import-percentage">{Math.round(progress * 100)}%</p>
                  </IonText>
                )}
              </div>
              <IonText color="medium" className="import-description">
                <p>Generating thumbnails and checking for duplicates...</p>
              </IonText>
            </>
          )}

          {/* Success State */}
          {!isImporting && importResult?.success && (
            <>
              <div className="import-result-icon success">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <IonText>
                <h2 className="import-result-title">Import Successful!</h2>
              </IonText>
              
              <div className="import-stats">
                <div className="import-stat-item">
                  <IonBadge color="success" className="import-stat-badge">
                    {importResult.imported.length}
                  </IonBadge>
                  <IonText color="medium">
                    <p>Photos Imported</p>
                  </IonText>
                </div>
                
                {importResult.duplicates > 0 && (
                  <div className="import-stat-item">
                    <IonBadge color="warning" className="import-stat-badge">
                      {importResult.duplicates}
                    </IonBadge>
                    <IonText color="medium">
                      <p>Duplicates Skipped</p>
                    </IonText>
                  </div>
                )}
                
                {importResult.failed > 0 && (
                  <div className="import-stat-item">
                    <IonBadge color="danger" className="import-stat-badge">
                      {importResult.failed}
                    </IonBadge>
                    <IonText color="medium">
                      <p>Failed</p>
                    </IonText>
                  </div>
                )}
              </div>

              {(importResult.duplicates > 0 || importResult.failed > 0) && (
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  className="import-details-toggle"
                >
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </IonButton>
              )}

              {showDetails && (
                <div className="import-details">
                  {importResult.duplicates > 0 && (
                    <div className="import-detail-section">
                      <IonText color="warning">
                        <h3>
                          <IonIcon icon={duplicate} /> Duplicates Skipped
                        </h3>
                        <p>
                          {importResult.duplicates} photo{importResult.duplicates > 1 ? 's were' : ' was'} already in your library
                        </p>
                      </IonText>
                    </div>
                  )}
                  
                  {importResult.failed > 0 && importResult.errors && importResult.errors.length > 0 && (
                    <div className="import-detail-section">
                      <IonText color="danger">
                        <h3>
                          <IonIcon icon={alertCircle} /> Failed Imports
                        </h3>
                      </IonText>
                      <IonList className="import-error-list">
                        {importResult.errors.slice(0, 5).map((error, index) => (
                          <IonItem key={index} lines="none">
                            <IonLabel className="ion-text-wrap">
                              <p>{error}</p>
                            </IonLabel>
                          </IonItem>
                        ))}
                        {importResult.errors.length > 5 && (
                          <IonItem lines="none">
                            <IonLabel>
                              <p>... and {importResult.errors.length - 5} more</p>
                            </IonLabel>
                          </IonItem>
                        )}
                      </IonList>
                    </div>
                  )}
                </div>
              )}

              <IonButton
                expand="block"
                onClick={handleDismiss}
                className="import-done-button"
              >
                Done
              </IonButton>
            </>
          )}

          {/* Error State */}
          {!isImporting && importResult && !importResult.success && (
            <>
              <div className="import-result-icon error">
                <IonIcon icon={alertCircle} />
              </div>
              <IonText color="danger">
                <h2 className="import-result-title">Import Failed</h2>
                {importResult.errors && importResult.errors.length > 0 && (
                  <p className="import-error-message">{importResult.errors[0]}</p>
                )}
              </IonText>
              
              {importResult.errors && importResult.errors.length > 1 && (
                <>
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() => setShowDetails(!showDetails)}
                    className="import-details-toggle"
                  >
                    {showDetails ? 'Hide Details' : 'Show All Errors'}
                  </IonButton>
                  
                  {showDetails && (
                    <IonList className="import-error-list">
                      {importResult.errors.map((error, index) => (
                        <IonItem key={index} lines="none">
                          <IonLabel className="ion-text-wrap">
                            <p>{error}</p>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </IonList>
                  )}
                </>
              )}

              <IonButton
                expand="block"
                onClick={handleDismiss}
                className="import-done-button"
              >
                Close
              </IonButton>
            </>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default PhotoImportModal;
