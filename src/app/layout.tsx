import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/session-provider-wrapper";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "المعلم X",
  description: "معلم افتراضي بالذكاء الاصطناعي لطلاب المرحلة الثانوية في العراق",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
