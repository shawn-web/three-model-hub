// antd 主题配置

// 暗色主题配置
export const darkThemeConfig = {
  token: {
    colorPrimary: '#4a9eff',
    borderRadius: 6,
    colorBgContainer: '#1a1a2e',
    colorBgLayout: '#0f0f1a',
    colorBgElevated: '#1e1e32',
    colorBorder: 'rgba(255,255,255,0.08)',
    colorText: '#ddd',
    colorTextSecondary: '#aaa',
  },
  components: {
    Layout: {
      headerBg: '#1a1a2e',
      headerColor: '#fff',
    },
  },
}

// 亮色主题配置
export const lightThemeConfig = {
  token: {
    colorPrimary: '#4a9eff',
    borderRadius: 6,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerColor: '#333333',
      headerPadding: '0 24px',
    },
    Menu: {
      horizontalItemHoverColor: '#4a9eff',
      itemColor: '#555555',
      itemHoverColor: '#4a9eff',
      horizontalItemSelectedColor: '#4a9eff',
    },
  },
}

export type ThemeMode = 'dark' | 'light'

export function getThemeConfig(mode: ThemeMode) {
  return mode === 'dark' ? darkThemeConfig : lightThemeConfig
}
