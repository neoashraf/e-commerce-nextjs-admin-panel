/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only ships the traced node_modules, not the full tree.
  output: "standalone",
  // Admin panel is non-indexable application UI; no SEO image optimization needs by default.
  // Add the backend asset host here when admin pages render uploaded product/content images.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
