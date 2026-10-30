"use client";

import type { CSSProperties } from "react";
import "./scene.css";

export type Facing = "down" | "up" | "left" | "right";

/** Four frames per row: front-facing and side-facing walking poses. */
export default function CharSprite({
  facing = "down", walking = false, height = 84,
  sheet = "/assets/scene/courier-1-walk.png",
}: {
  facing?: Facing;
  walking?: boolean;
  height?: number;
  sheet?: string;
}) {
  const sideways = facing === "left" || facing === "right";
  const style = {
    height, width: height,
    backgroundImage: `url(${sheet})`,
    backgroundSize: `${height * 4}px ${height * 2}px`,
    backgroundPositionY: sideways ? -height : 0,
    "--frame-size": `${height}px`,
    transform: facing === "left" ? "scaleX(-1)" : undefined,
  } as CSSProperties;

  return <span
    className={`char-sprite ${walking ? "walking" : "idle"}`}
    style={style}
    aria-hidden="true"
  />;
}
