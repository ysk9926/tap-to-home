"use client";

import { useEffect, useState } from "react";
import { HOME_THRESHOLD } from "../stages";

/** Local taps and realtime friend updates share the same short departure animation. */
export function useRaceMotion(count: number) {
  const [motion, setMotion] = useState({ count, running: false });
  if (motion.count !== count) {
    setMotion({ count, running: count > motion.count && count < HOME_THRESHOLD });
  }
  useEffect(() => {
    if (!motion.running) return;
    const timer = setTimeout(() => setMotion((current) => ({ ...current, running: false })), 800);
    return () => clearTimeout(timer);
  }, [motion.count, motion.running]);
  return motion.running && count < HOME_THRESHOLD;
}
