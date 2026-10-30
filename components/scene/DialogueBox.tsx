"use client";

import { useEffect, useRef, useState } from "react";
import "./scene.css";

/**
 * Original retro-RPG-style dialogue box that pops up on order status changes.
 * Shows a small courier portrait + a typed-out message "from" the courier.
 * This is an original UI design (not a copy of any game's assets).
 *
 * Props:
 *   message  - the full line to type out. When it changes, the box animates in
 *              and types the new text; empty string hides the box.
 *   portrait - optional URL of the courier face image to show in the box.
 */
export default function DialogueBox({
  message,
  portrait,
}: {
  message: string;
  portrait?: string;
}) {
  const [typed, setTyped] = useState("");
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!message) {
      setVisible(false);
      setTyped("");
      return;
    }
    setVisible(true);
    setTyped("");
    // typewriter effect
    for (let i = 1; i <= message.length; i++) {
      timers.current.push(
        window.setTimeout(() => setTyped(message.slice(0, i)), i * 35)
      );
    }
    // auto-hide a few seconds after fully typed
    const hideAt = message.length * 35 + 4500;
    timers.current.push(window.setTimeout(() => setVisible(false), hideAt));
    return () => timers.current.forEach(clearTimeout);
  }, [message]);

  if (!visible) return null;

  return (
    <div className="dialogue-box" role="status" aria-live="polite">
      <div
        className="dialogue-portrait"
        aria-hidden="true"
        style={portrait ? { backgroundImage: `url(${portrait})` } : undefined}
      />
      <p className="dialogue-text">
        {typed}
        <span className="dialogue-caret">▌</span>
      </p>
    </div>
  );
}
