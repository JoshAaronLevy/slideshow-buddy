/**
 * CustomPlaylistCard - Display custom playlist with metadata and actions
 */

import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
  IonActionSheet,
} from '@ionic/react';
import {
  musicalNotesOutline,
  ellipsisVertical,
  play,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { CustomPlaylist } from '../types/playlist';
import * as HapticService from '../services/HapticService';
import './CustomPlaylistCard.css';

interface CustomPlaylistCardProps {
  playlist: CustomPlaylist;
  onPlay: (playlist: CustomPlaylist) => void;
  onEdit: (playlist: CustomPlaylist) => void;
  onDelete: (playlist: CustomPlaylist) => void;
}

/**
 * Format timestamp to readable date
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

/**
 * CustomPlaylistCard Component
 */
const CustomPlaylistCard: React.FC<CustomPlaylistCardProps> = ({
  playlist,
  onPlay,
  onEdit,
  onDelete,
}) => {
  const [showActionSheet, setShowActionSheet] = useState(false);

  const handleCardClick = () => {
    HapticService.impactLight();
    onPlay(playlist);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.impactLight();
    setShowActionSheet(true);
  };

  const handlePlay = () => {
    HapticService.impactMedium();
    onPlay(playlist);
  };

  const handleEdit = () => {
    HapticService.impactLight();
    onEdit(playlist);
  };

  const handleDelete = () => {
    HapticService.impactMedium();
    onDelete(playlist);
  };

  // Get thumbnail from playlist or use placeholder
  const thumbnailUri = playlist.thumbnailUri;

  return (
    <>
      <IonCard className="custom-playlist-card" onClick={handleCardClick}>
        <div className="playlist-card-content">
          {/* Thumbnail */}
          <div className="playlist-thumbnail">
            {thumbnailUri ? (
              <img src={thumbnailUri} alt={playlist.name} />
            ) : (
              <div className="playlist-thumbnail-placeholder">
                <IonIcon icon={musicalNotesOutline} />
              </div>
            )}
            <div className="playlist-overlay">
              <IonIcon icon={play} className="play-icon" />
            </div>
          </div>

          {/* Content */}
          <IonCardContent>
            <div className="playlist-header">
              <div className="playlist-info">
                <h3>{playlist.name}</h3>
                <div className="playlist-metadata">
                  <IonText color="medium">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                  </IonText>
                  {playlist.tags && playlist.tags.length > 0 && (
                    <>
                      <span className="metadata-separator">•</span>
                      <IonText color="medium">
                        {playlist.tags.slice(0, 2).join(', ')}
                        {playlist.tags.length > 2 && ` +${playlist.tags.length - 2}`}
                      </IonText>
                    </>
                  )}
                </div>
                <IonText color="medium" className="playlist-date">
                  <small>Created {formatDate(playlist.createdAt)}</small>
                </IonText>
              </div>

              {/* Menu Button */}
              <button
                className="playlist-menu-button"
                onClick={handleMenuClick}
                aria-label="Playlist options"
              >
                <IonIcon icon={ellipsisVertical} />
              </button>
            </div>
          </IonCardContent>
        </div>
      </IonCard>

      {/* Action Sheet */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        header={playlist.name}
        buttons={[
          {
            text: 'Play',
            icon: play,
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
    </>
  );
};

export default CustomPlaylistCard;
