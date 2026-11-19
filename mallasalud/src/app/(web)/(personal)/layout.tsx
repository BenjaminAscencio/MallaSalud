import { IntranetHeader } from "@/components";

export default function PersonalSomeLayout({
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
