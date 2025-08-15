import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Venditio",
  description: "Venditio - Paper Trading Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        <div
          className="about"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-label="About us"
          data-darkreader-ignore
        >
          <a
            className="about-trigger about-twitter"
            href="https://x.com/literallyHS824"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter profile"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              focusable="false"
              suppressHydrationWarning
              data-darkreader-ignore
            >
              <path d="M23.954 4.569c-.885.392-1.83.656-2.825.775 1.014-.608 1.794-1.574 2.163-2.723-.949.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-2.72 0-4.924 2.205-4.924 4.917 0 .39.045.765.127 1.124-4.09-.205-7.719-2.164-10.148-5.144-.424.722-.667 1.561-.667 2.475 0 1.708.87 3.216 2.188 4.099-.807-.026-1.566-.248-2.228-.616v.062c0 2.385 1.693 4.374 3.946 4.827-.413.11-.849.171-1.296.171-.314 0-.615-.03-.916-.086.631 1.953 2.445 3.376 4.6 3.416-1.68 1.319-3.809 2.105-6.102 2.105-.39 0-.779-.023-1.17-.067 2.189 1.394 4.768 2.209 7.557 2.209 9.054 0 14.002-7.496 14.002-13.986 0-.21 0-.423-.015-.637.962-.695 1.8-1.562 2.46-2.549z" />
            </svg>
          </a>
          <span className="about-trigger" role="button">
            About us
          </span>
          <div className="about-popup" role="dialog" aria-modal="false">
            <div className="about-inner">
              <p className="about-head">
                <strong>literallyHS tarafından geliştirildi.</strong>
              </p>
              <p>
                Bu al‑sat ajanı, yalnızca Cursor ve GPT‑5 ile geliştirildi.
                Amacı, bir ajan aracılığıyla paper trading deneyimi sunmaktır.
                Fiyatlar anlık güncellenir; tüm işlemler simülasyondur.
              </p>
              <hr />
              <p className="about-head">
                <strong>Built by literallyHS.</strong>
              </p>
              <p>
                This trading agent was created solely with Cursor and GPT‑5. Its
                purpose is to provide a paper trading experience with an agent.
                Price data updates in real time, while all orders are fully
                simulated.
              </p>
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
