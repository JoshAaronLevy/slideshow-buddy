/**
 * SlideshowCard - Displays a saved slideshow with thumbnail and metadata
 */

import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
  IonButton,
  IonActionSheet,
  IonAccordionGroup,
  IonAccordion,
  IonItem,
  IonLabel,
} from '@ionic/react';
import {
  playCircleOutline,
  createOutline,
  trashOutline,
  ellipsisVertical,
  imagesOutline,
  musicalNotesOutline,
  timeOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { SavedSlideshow } from '../types/slideshow';
import * as HapticService from '../services/HapticService';
import { isMacOS } from '../utils/platform';
import ContextMenu from './ContextMenu';
import './SlideshowCard.css';

interface SlideshowCardProps {
  slideshow: SavedSlideshow;
  onPlay: (slideshow: SavedSlideshow) => void;
  onEdit: (slideshow: SavedSlideshow) => void;
  onDelete: (slideshow: SavedSlideshow) => void;
}

/**
 * Format timestamp to readable date
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

/**
 * Get music source display text
 */
const getMusicSourceText = (slideshow: SavedSlideshow): string => {
  if (slideshow.musicSource.type === 'none') {
    return 'No music';
  } else if (slideshow.musicSource.type === 'custom-playlist') {
    return 'Custom playlist';
  } else {
    return 'Spotify playlist';
  }
};

/**
 * SlideshowCard Component
 */
const SlideshowCard: React.FC<SlideshowCardProps> = ({
  slideshow,
  onPlay,
  onEdit,
  onDelete,
}) => {
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleCardClick = async () => {
    await HapticService.impactLight();
    setShowActionSheet(true);
  };

  const handlePlay = async () => {
    await HapticService.impactMedium();
    onPlay(slideshow);
  };

  const handleEdit = async () => {
    await HapticService.impactLight();
    onEdit(slideshow);
  };

  const handleDelete = async () => {
    await HapticService.impactMedium();
    onDelete(slideshow);
  };

  const handleDuplicate = async () => {
    await HapticService.impactLight();
    // Create a copy of the slideshow with a new name and timestamp
    const duplicatedSlideshow: SavedSlideshow = {
      ...slideshow,
      id: Math.random().toString(36).substr(2, 9),
      name: `${slideshow.name} Copy`,
      createdAt: Date.now(),
      lastPlayedAt: null,
      playCount: 0,
    };
    onEdit(duplicatedSlideshow);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isMacOS()) return;
    
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = [
    { label: 'Edit', action: () => onEdit(slideshow) },
    { label: 'Duplicate', action: handleDuplicate },
    { separator: true },
    { label: 'Delete', action: () => onDelete(slideshow), destructive: true }
  ];

  return (
    <>
      <IonCard className="slideshow-card" onContextMenu={handleContextMenu}>
        <div className="slideshow-card-thumbnail" onClick={handleCardClick}>
          {slideshow.thumbnailUri ? (
            <img src={slideshow.thumbnailUri} alt={slideshow.name} />
          ) : (
            <div className="slideshow-card-placeholder">
              <IonIcon icon={imagesOutline} />
            </div>
          )}
          <div className="slideshow-card-overlay">
            <IonIcon icon={playCircleOutline} className="play-icon" />
          </div>
        </div>

        <IonCardContent>
          <div className="slideshow-card-header">
            <h2 className="slideshow-card-title">{slideshow.name}</h2>
            <IonButton fill="clear" size="small" onClick={(e) => {
              e.stopPropagation();
              setShowActionSheet(true);
            }}>
              <IonIcon icon={ellipsisVertical} />
            </IonButton>
          </div>

          <IonAccordionGroup>
            <IonAccordion value="details" toggleIconSlot="start">
              <IonItem 
                slot="header" 
                lines="none" 
                className="slideshow-details-header"
                onClick={(e) => e.stopPropagation()}
              >
                <IonLabel>
                  <IonText color="medium">
                    <p className="details-toggle">Show Details</p>
                  </IonText>
                </IonLabel>
              </IonItem>
              
              <div slot="content" className="slideshow-card-metadata">
                <div className="metadata-item">
                  <IonIcon icon={imagesOutline} />
                  <IonText>{slideshow.photoIds.length} photos</IonText>
                </div>
                <div className="metadata-item">
                  <IonIcon icon={musicalNotesOutline} />
                  <IonText>{getMusicSourceText(slideshow)}</IonText>
                </div>
                <div className="metadata-item">
                  <IonIcon icon={timeOutline} />
                  <IonText>{slideshow.settings.transitionTime}s per slide</IonText>
                </div>
                <div className="metadata-item">
                  <IonIcon icon={timeOutline} />
                  <IonText color="medium">
                    {slideshow.lastPlayedAt 
                      ? `Played ${formatDate(slideshow.lastPlayedAt)}`
                      : `Created ${formatDate(slideshow.createdAt)}`}
                  </IonText>
                </div>
                {slideshow.playCount > 0 && (
                  <div className="metadata-item">
                    <IonIcon icon={playCircleOutline} />
                    <IonText color="medium">
                      {slideshow.playCount} {slideshow.playCount === 1 ? 'play' : 'plays'}
                    </IonText>
                  </div>
                )}
              </div>
            </IonAccordion>
          </IonAccordionGroup>
        </IonCardContent>
      </IonCard>

      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        header={slideshow.name}
        buttons={[
          {
            text: 'Play',
            icon: playCircleOutline,
            handler: handlePlay,
          },
          {
            text: 'Edit',
            icon: createOutline,
            handler: handleEdit,
          },
          {
            text: 'Delete',
            icon: trashOutline,
            role: 'destructive',
            handler: handleDelete,
          },
          {
            text: 'Cancel',
            role: 'cancel',
          },
        ]}
      />
      
      {contextMenu && (
        <ContextMenu
          items={menuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};

export default SlideshowCard;
