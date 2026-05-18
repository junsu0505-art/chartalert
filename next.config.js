/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // .js 확장자로 import된 TypeScript 파일을 Next.js webpack이 찾을 수 있도록 extensionAlias 등록.
    // 기존 컴포넌트(Chart.tsx, hooks/*.ts 등)가 '../lib/charts/index.js' 형식으로 import하므로 필요.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
    }
    return config
  },
};

module.exports = nextConfig;
