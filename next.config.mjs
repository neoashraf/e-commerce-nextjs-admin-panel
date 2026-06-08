/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only ships the traced node_modules, not the full tree.
  //
  // Gated behind BUILD_STANDALONE: the standalone tracer symlinks node_modules
  // into .next/standalone, which fails with EPERM on Windows + OneDrive (no
  // symlink permission). The Dockerfile sets BUILD_STANDALONE=1 so the deploy
  // image still gets server.js; a plain local `next build` skips it and passes.
  ...(process.env.BUILD_STANDALONE ? { output: "standalone" } : {}),
  // Admin panel is non-indexable application UI; no SEO image optimization needs by default.
  // Add the backend asset host here when admin pages render uploaded product/content images.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
