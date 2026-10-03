import type { NextConfig } from "next";

// Las calculadoras de presupuesto pasaron a /admin/presupuesto (solo con login);
// las rutas públicas antiguas redirigen al catálogo.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/presupuesto", destination: "/catalogo", permanent: false },
      { source: "/presupuesto/:path*", destination: "/catalogo", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.publicatalogue.com",
        pathname: "/image/**",
      },
    ],
  },
};

export default nextConfig;
