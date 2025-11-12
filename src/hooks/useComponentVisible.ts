/**
 * useComponentVisible - Track component visibility in Ionic tabs
 * Helps pause timers/operations when component is not visible
 */

import { useState } from 'react';
import { useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';

/**
 * Hook to track if the current component/page is visible
 * Uses Ionic lifecycle hooks to detect tab changes
 * 
 * @returns boolean - true if component is visible, false otherwise
 */
export const useComponentVisible = (): boolean => {
  const [isVisible, setIsVisible] = useState(false);

  // Component becomes visible
  useIonViewDidEnter(() => {
    console.log('[useComponentVisible] Component became visible');
    setIsVisible(true);
  });

  // Component is about to leave
  useIonViewWillLeave(() => {
    console.log('[useComponentVisible] Component leaving');
    setIsVisible(false);
  });

  return isVisible;
};
