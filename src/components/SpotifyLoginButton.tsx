/**
 * SpotifyLoginButton Component
 * 
 * Reusable button component for Spotify OAuth login
 * Uses the useSpotifyAuth hook to handle the OAuth flow
 * 
 * @example
 * ```tsx
 * <SpotifyLoginButton
 *   onSuccess={(tokens) => {
 *     console.log('Logged in with token:', tokens.access_token);
 *   }}
 *   onError={(error) => {
 *     console.error('Login failed:', error);
 *   }}
 * />
 * ```
 */

import React from 'react';
import { IonButton, IonIcon, IonSpinner, IonText } from '@ionic/react';
import { musicalNotesOutline, checkmarkCircle, closeCircle } from 'ionicons/icons';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { SpotifyTokenResponse } from '../services/spotifyAuth';
import './SpotifyLoginButton.css';

interface SpotifyLoginButtonProps {
  /**
   * Called when login succeeds
   * 
   * TODO: Implement token storage in your app
   * (e.g., Capacitor Preferences, secure storage, state management)
   */
  onSuccess?: (tokens: SpotifyTokenResponse) => void;

  /**
   * Called when login fails
   */
  onError?: (error: Error) => void;

  /**
   * Button text (default: "Connect with Spotify")
   */
  buttonText?: string;

  /**
   * Button expand mode (default: "block")
   */
  expand?: 'full' | 'block';

  /**
   * Button fill mode (default: "solid")
   */
  fill?: 'clear' | 'outline' | 'solid';

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Show detailed status messages
   */
  showStatus?: boolean;
}

/**
 * Spotify login button with OAuth flow handling
 */
export const SpotifyLoginButton: React.FC<SpotifyLoginButtonProps> = ({
  onSuccess,
  onError,
  buttonText = 'Connect with Spotify',
  expand = 'block',
  fill = 'solid',
  className = '',
  showStatus = false,
}) => {
  const { loginWithSpotify, status, error } = useSpotifyAuth({
    onSuccess,
    onError,
  });

  const isLoading = status === 'pending' || status === 'exchanging';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const handleClick = async () => {
    await loginWithSpotify();
  };

  return (
    <div className={`spotify-login-button-container ${className}`}>
      <IonButton
        expand={expand}
        fill={fill}
        onClick={handleClick}
        disabled={isLoading}
        className="spotify-login-button"
        color={isSuccess ? 'success' : isError ? 'danger' : 'primary'}
      >
        {isLoading ? (
          <>
            <IonSpinner name="crescent" slot="start" />
            {status === 'pending' ? 'Opening Spotify...' : 'Exchanging token...'}
          </>
        ) : isSuccess ? (
          <>
            <IonIcon icon={checkmarkCircle} slot="start" />
            Connected!
          </>
        ) : isError ? (
          <>
            <IonIcon icon={closeCircle} slot="start" />
            Try Again
          </>
        ) : (
          <>
            <IonIcon icon={musicalNotesOutline} slot="start" />
            {buttonText}
          </>
        )}
      </IonButton>

      {/* Status Messages */}
      {showStatus && status !== 'idle' && (
        <div className="spotify-login-status">
          {isLoading && (
            <IonText color="medium">
              <p>
                {status === 'pending'
                  ? 'Please complete login in the browser...'
                  : 'Verifying credentials...'}
              </p>
            </IonText>
          )}
          {isSuccess && (
            <IonText color="success">
              <p>✓ Successfully connected to Spotify</p>
            </IonText>
          )}
          {isError && error && (
            <IonText color="danger">
              <p>✗ {error}</p>
            </IonText>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyLoginButton;
