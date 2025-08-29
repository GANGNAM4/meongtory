/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'meongtory.s3.ap-northeast-2.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shopping-phinf.pstatic.net',
        port: '',
        pathname: '/**',
      },
      // 실시간 로고를 위한 다양한 도메인 허용
      {
        protocol: 'https',
        hostname: '*.samsungfire.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.nhfire.co.kr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.kbinsure.co.kr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.hi.co.kr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.meritzfire.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.dbins.co.kr',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/ai/:path*',
        destination: 'http://localhost:9000/:path*',
      },
    ];

  },
}

export default nextConfig
