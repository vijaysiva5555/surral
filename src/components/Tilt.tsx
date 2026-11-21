"use client";
import { useRef } from "react";

/** Tilts its content towards the pointer in 3D, with a soft glare where the light falls. Does nothing on touch screens
    and for people who ask for reduced motion. */
export default function Tilt({ children, className = "", max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = () => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches;
  return (
    <div ref={ref} className={className}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || still() || e.pointerType !== "mouse") return;
        const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
        el.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
        el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`); el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
        el.classList.add("tilt-on");
      }}
      onPointerLeave={() => { const el = ref.current; if (el) { el.style.transform = ""; el.classList.remove("tilt-on"); } }}>
      <span className="tilt-glare" aria-hidden />
      {children}
    </div>
  );
}
