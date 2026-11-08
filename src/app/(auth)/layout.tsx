import { Sora } from "next/font/google";
import "@/app/(marketing)/site/site.css";

const sans = Sora({
  subsets: ["latin"],
  variable: "--font-site-sans",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sans.variable} site-root min-h-screen`}>{children}</div>;
}
