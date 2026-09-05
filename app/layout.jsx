import "./globals.css";
import Providers from "./providers";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const title = "Kedros: Software built around your business";
const description = "Kedros builds custom software around the way your business actually works.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: ["Kedros", "custom software development", "business software", "software consultancy"],
  icons: {
    icon: "/assets/kedros-symbol.png"
  },
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title,
    description,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/assets/kedros-lockup.png" }],
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/assets/kedros-lockup.png"]
  }
};

export const viewport = {
  themeColor: "#0F134E"
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/assets/kedros-symbol-brand.png`,
  description
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
