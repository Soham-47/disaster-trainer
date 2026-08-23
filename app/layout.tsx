import "./globals.css";
import React from "react";

export const metadata = {
  title: "Apartment Fire Trainer — Happy Oyster",
  description:
    "A live first-person apartment-fire training simulation powered by Happy Oyster and a deterministic safety engine.",
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
