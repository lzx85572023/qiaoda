import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kekefufu.qiaoda',
  appName: '巧答',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: true
  }
}

export default config
