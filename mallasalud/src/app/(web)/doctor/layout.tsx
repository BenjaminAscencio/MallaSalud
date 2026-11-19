import { IntranetHeader } from "@/components";

export default function DoctorBoxLayout({
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
