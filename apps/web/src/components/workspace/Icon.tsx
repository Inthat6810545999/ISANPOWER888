import type { CSSProperties } from "react";

const paths = {
  requests: "M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 3h6v4H9zM8 11h8M8 15h8",
  queue: "M3 8h18v12H3zM3 8l3-5h12l3 5M3 13h5l2 3h4l2-3h5",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M7 17 17 7M7 7h10v10",
  flask: "M9 3h6M10 3v6L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6",
  close: "m6 6 12 12M6 18 18 6",
  download: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
  check: "m4 12 5 5L20 6",
} as const;

export function Icon({ name, style }: { name: keyof typeof paths; style?: CSSProperties }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
    <path d={paths[name]} />
  </svg>;
}
