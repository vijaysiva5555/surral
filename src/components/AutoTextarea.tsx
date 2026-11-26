"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A text box that wraps and grows with its text, so a long description is shown in full instead of being cut off.
    Enter is left to the caller (the BOM sheet uses it to move down a row); new lines typed or pasted are kept. */
const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoTextarea({ className = "", value, onInput, ...rest }, outer) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(outer, () => ref.current as HTMLTextAreaElement);
  const fit = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; };
  useLayoutEffect(fit, [value]);
  useLayoutEffect(() => {   // the width can change (window size, the sheet scrolling into view) – fit again
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; fit(); } }); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} value={value} onInput={(e) => { fit(); onInput?.(e); }} className={`resize-none overflow-hidden whitespace-pre-wrap break-words ${className}`} {...rest} />;
});
export default AutoTextarea;
