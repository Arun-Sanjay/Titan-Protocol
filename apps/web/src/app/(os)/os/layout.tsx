import { OSShell } from "../components/OSShell";
import "../dashboard.css";
import "../premium-ui.css";

export default function OSRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="osCanvas">
      <div className="osStage">
        <OSShell>{children}</OSShell>
      </div>
    </main>
  );
}
