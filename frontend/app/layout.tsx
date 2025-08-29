import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navigation, { AuthProvider } from "@/components/navigation";
import Chatbot from "@/components/features/chatbot";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as HotToaster } from "react-hot-toast";
import QueryProvider from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "멍토리",
  description: "Created with v0",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/paw-favicon.png" type="image/png" />
        <style>{`
          html {
            font-family: ${GeistSans.style.fontFamily};
            --font-sans: ${GeistSans.variable};
            --font-mono: ${GeistMono.variable};
          }
        `}</style>
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>
            <Navigation />
            {children}
            <Chatbot />
            <Toaster />
            <HotToaster position="top-center" reverseOrder={false} />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}