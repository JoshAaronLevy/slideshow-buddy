import { Capacitor } from '@capacitor/core';

export const getPlatform = () => Capacitor.getPlatform();
export const isIOS = () => getPlatform() === 'ios';
export const isAndroid = () => getPlatform() === 'android';
export const isMacOS = () => getPlatform() === 'electron';
export const isWeb = () => getPlatform() === 'web';
export const isMobile = () => isIOS() || isAndroid();
export const isDesktop = () => isMacOS();