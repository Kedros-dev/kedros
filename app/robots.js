import { SITE_URL } from "@/lib/seo";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/login", "/account", "/admin", "/api"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
