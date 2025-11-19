"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
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
exports.default = config;
