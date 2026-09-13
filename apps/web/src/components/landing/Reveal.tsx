"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./landing.module.css";

export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Keep server-rendered content visible until enhancement is available.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.dataset.visible = "true";
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    element.dataset.visible = "false";
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={styles.reveal}>{children}</div>;
}
