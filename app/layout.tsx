import "./globals.css";
import React from "react";

export const metadata = {
  title: "Counterfactual Disaster Trainer — Reactor World Model",
  description:
    "Interactive disaster decision trainer powered by LingBot World 2 and deterministic safety scenario engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
