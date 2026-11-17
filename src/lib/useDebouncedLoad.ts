"use client";
import { useEffect, useRef } from "react";

/** Runs `load` at once when a list page opens, and 250 ms after the last change while the user types in a filter.
    (A plain debounce also delayed the very first load of every list by a quarter of a second.) */
export function useDebouncedLoad(load: () => void, deps: unknown[], ms = 250) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; load(); return; }
    const t = setTimeout(load, ms);
    return () => clearTimeout(t);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
