/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Admin panel is non-indexable application UI; no SEO image optimization needs by default.
  // Add the backend asset host here when admin pages render uploaded product/content images.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
