import type { Metadata } from "next";
import React from "react";
import "@fontsource/space-grotesk";
import "@fontsource/playfair-display";
import "@fontsource/space-mono";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Project Dashboard",
  description: "Monitor and manage academic projects with ease",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased min-h-screen flex flex-col relative bg-background"
        style={
          {
            "--font-space-grotesk": '"Space Grotesk", sans-serif',
            "--font-playfair": '"Playfair Display", serif',
            "--font-space-mono": '"Space Mono", monospace',
          } as React.CSSProperties
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Architectural Background Grid Layers */}
          <div className="editorial-grid" />
          <div className="editorial-guides">
            <div className="editorial-guides-center w-[1px] h-full bg-border/50"></div>
          </div>

          <QueryProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-space-mono)",
                  borderRadius: "2px",
                  textTransform: "uppercase",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                },
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
