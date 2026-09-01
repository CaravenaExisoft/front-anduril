import { useEffect, useRef } from "react";
import { mountAnduriHead } from "./anduriHeadEngine.js";
import anduriHeadGlbUrl from "./anduril_head.glb?url";

export default function AnduriHead({ className }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    return mountAnduriHead(container, anduriHeadGlbUrl);
  }, []);

  return <div ref={containerRef} className={className} />;
}
