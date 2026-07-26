import { SiteHeader } from "@/components/site/SiteHeader";
import { Footer } from "@/components/site/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
