import { OSShell } from "../components/OSShell";

export default function OSRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <OSShell>{children}</OSShell>;
}
