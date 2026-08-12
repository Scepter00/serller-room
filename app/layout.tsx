import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/client/session";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Serller is a Web3 social application built around Stellar: wallet identity, posts, follows, and real XLM tips. Testnet first.",
  keywords: ["stellar", "web3", "social", "xlm", "soroban", "tips"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#090910" },
  ],
};

/** Apply the persisted theme before paint to avoid a flash. */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('serller-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-t1">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
