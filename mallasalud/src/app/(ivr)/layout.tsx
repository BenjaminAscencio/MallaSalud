import { IntranetHeader } from "@/components";

export default function IvrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <IntranetHeader />
      <main className="layout-main">{children}</main>
    </>
  );
}
