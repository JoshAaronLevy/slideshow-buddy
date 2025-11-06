/**
 * PhotoPickerModal - Reusable modal for selecting photos from the library
 * Displays a grid of photos with multi-select capability
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
  IonFooter,
  IonBadge,
  IonSpinner,
} from '@ionic/react';
import { close, checkmarkCircle, addOutline, imagesOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { Photo } from '../types';
import * as HapticService from '../services/HapticService';
import './PhotoPickerModal.css';

interface PhotoPickerModalProps {
  isOpen: boolean;
  photos: Photo[];
  selectedPhotoIds: string[];
  isLoading?: boolean;
  onDismiss: () => void;
  onConfirm: (selectedPhotoIds: string[]) => void;
  onImportPhotos: () => Promise<void>;
  title?: string;
  confirmText?: string;
}

/**
 * PhotoPickerModal Component
 * Allows users to select multiple photos from their library
 */
const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  isOpen,
  photos,
  selectedPhotoIds: initialSelectedIds,
  isLoading = false,
  onDismiss,
  onConfirm,
  onImportPhotos,
  title = 'Select Photos',
  confirmText = 'Done',
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Initialize selection state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds));
    }
  }, [isOpen, initialSelectedIds]);

  const handlePhotoClick = (photoId: string) => {
    HapticService.impactLight();
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    HapticService.impactMedium();
    setSelectedIds(new Set(photos.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    HapticService.impactLight();
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    HapticService.impactMedium();
    onConfirm(Array.from(selectedIds));
  };

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const handleImport = async () => {
    HapticService.impactMedium();
    setImporting(true);
    try {
      await onImportPhotos();
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = selectedIds.size;
  const hasPhotos = photos.length > 0;
  const canConfirm = selectedCount > 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {hasPhotos && selectedCount > 0 && (
          <IonToolbar>
            <div className="photo-picker-actions">
              <IonButton size="small" fill="clear" onClick={handleSelectAll}>
                Select All
              </IonButton>
              <IonBadge color="primary" className="selection-badge">
                {selectedCount} selected
              </IonBadge>
              <IonButton size="small" fill="clear" onClick={handleDeselectAll}>
                Deselect All
              </IonButton>
            </div>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent className="photo-picker-content">
        {/* Loading State */}
        {(isLoading || importing) && (
          <div className="photo-picker-loading">
            <IonSpinner name="crescent" />
            <IonText>
              <p>{importing ? 'Importing photos...' : 'Loading...'}</p>
            </IonText>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !importing && !hasPhotos && (
          <div className="photo-picker-empty">
            <IonIcon icon={imagesOutline} className="empty-icon" />
            <IonText color="medium">
              <h2>No Photos Yet</h2>
              <p>Import photos from your library to get started</p>
            </IonText>
            <IonButton expand="block" onClick={handleImport} disabled={importing}>
              <IonIcon icon={addOutline} slot="start" />
              Import Photos
            </IonButton>
          </div>
        )}

        {/* Photo Grid */}
        {!isLoading && !importing && hasPhotos && (
          <>
            <div className="photo-picker-grid">
              {photos.map((photo) => {
                const isSelected = selectedIds.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className={`photo-picker-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handlePhotoClick(photo.id)}
                  >
                    <img src={photo.uri} alt={photo.filename} loading="lazy" />
                    {isSelected && (
                      <div className="photo-picker-overlay">
                        <IonIcon icon={checkmarkCircle} className="checkmark-icon" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Import More Button */}
            <div className="photo-picker-import-more">
              <IonButton fill="outline" onClick={handleImport} disabled={importing}>
                <IonIcon icon={addOutline} slot="start" />
                Import More Photos
              </IonButton>
            </div>
          </>
        )}
      </IonContent>

      {/* Footer with confirm button */}
      {hasPhotos && (
        <IonFooter>
          <IonToolbar>
            <IonButton
              expand="block"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="photo-picker-confirm"
            >
              {confirmText} {selectedCount > 0 && `(${selectedCount})`}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonModal>
  );
};

export default PhotoPickerModal;
