import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luxtraderfx.app',
  appName: 'Lux Trader FX',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#07090E',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#07090E',
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2200,
      launchAutoHide: true,
      launchFadeOutDuration: 450,
      backgroundColor: '#07090E',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#07090E',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_lux',
      iconColor: '#3b82f6',
      sound: 'lux_alert',
    },
  },
};

export default config;
