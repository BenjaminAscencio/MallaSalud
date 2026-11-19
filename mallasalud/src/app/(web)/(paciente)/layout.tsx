import { Header, Footer } from "@/components";

export default function PacienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="layout-main">{children}</main>
      <Footer />
    </>
  );
}
