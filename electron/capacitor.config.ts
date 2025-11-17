import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.slideshowbuddy.app',
  appName: 'Slideshow Buddy',
  webDir: 'dist',
  plugins: {
    CapacitorElectron: {
      config: {
        build: {
          mac: {
            target: [
              {
                target: 'dmg',
                arch: ['x64', 'arm64']
              },
              {
                target: 'zip',
                arch: ['x64', 'arm64']
              }
            ],
            category: 'public.app-category.photography'
          }
        },
        directories: {
          output: 'dist-electron',
          buildResources: 'build'
        }
      }
    }
  }
};

export default config;
