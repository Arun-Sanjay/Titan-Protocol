import { OSShell } from "../components/OSShell";
import "../dashboard.css";

export default function OSRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <OSShell>{children}</OSShell>;
}
