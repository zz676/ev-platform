import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/components/context/AuthContext";
import { UserPanelProvider } from "@/components/context/UserPanelContext";
import { LoginModalProvider } from "@/components/context/LoginModalContext";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserPanel } from "@/components/layout/UserPanel";
import { LoginModal } from "@/components/auth/LoginModal";
import { BackToTop } from "@/components/layout/BackToTop";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EV Juice - China EV News & Analysis",
  description:
    "Stay updated with the latest EV news from China. Covering BYD, NIO, XPeng, Li Auto, and more. Bilingual coverage in English and Chinese.",
  keywords: ["China EV", "Electric Vehicle", "BYD", "NIO", "XPeng", "Li Auto", "EV News"],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <LoginModalProvider>
              <UserPanelProvider>
                <div className="min-h-screen bg-gray-50 flex flex-col">
                  <Header />
                  <main className="pb-8 flex-grow">
                    {children}
                  </main>
                  <Footer />
                  <UserPanel />
                  <LoginModal />
                  <BackToTop />
                </div>
              </UserPanelProvider>
            </LoginModalProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
