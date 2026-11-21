import { Boxes, Cog, FileText, FolderKanban, PackageCheck, Wrench, type LucideIcon } from "lucide-react";

const FACES: LucideIcon[] = [FileText, Boxes, Cog, Wrench, FolderKanban, PackageCheck];

/** A slowly turning glass cube – one face per part of the app (quotations, stock, equipment, spares, projects). */
export function Cube({ size = 120, className = "" }: { size?: number; className?: string }) {
  const icon = Math.round(size * 0.36);
  return (
    <div className={`scene-3d ${className}`} aria-hidden>
      <div className="cube" style={{ ["--s" as string]: `${size}px` }}>
        {FACES.map((Icon, i) => <div key={i} className="cube-face"><Icon style={{ width: icon, height: icon }} strokeWidth={1.4} /></div>)}
      </div>
    </div>
  );
}

/** The receding grid floor and the coloured light behind a dark 3D panel. */
export function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="glow-orb -left-24 -top-24 h-80 w-80 bg-brand-500/40" />
      <div className="glow-orb -bottom-32 right-0 h-96 w-96 bg-indigo-500/30" />
      <div className="glow-orb left-1/3 top-1/3 h-56 w-56 bg-cyan-400/20" />
      <div className="grid-floor" />
    </div>
  );
}
