import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Kedros: Software built around your business",
  description: "Kedros builds custom software around the way your business actually works.",
  icons: {
    icon: "/assets/kedros-symbol.png"
  }
};

export const viewport = {
  themeColor: "#0F134E"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
