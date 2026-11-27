import type { Metadata } from "next";
import { Bebas_Neue, Urbanist } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "360°_Bladez — The Art of the Cut | Barbershop in Addis Ababa",
  description:
    "Book a chair at 360°_Bladez, Addis Ababa's premium barbershop. Precision cuts, fades, beard sculpting and grooming — book online in minutes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bebas.variable} ${urbanist.variable} h-full antialiased scroll-smooth`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
