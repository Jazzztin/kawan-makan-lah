"use client";

import { useEffect, useRef, useState } from "react";
import CharSprite, { type Facing } from "./CharSprite";
import DialogueBox from "./DialogueBox";
import "./scene.css";

/**
 * Malaysia-themed order animation for the customer status page.
 *
 * A courier walks the viewer's single order along a tropical path through
 * four stages: Received -> Preparing -> Ready -> Collected. Malaysian animals
 * (tapir, hornbill, orangutan) wander the scene as ambient NPCs.
 *
 * Courier frames come from the user's Man_walking JPG sprite sheets.
 *
 * The real app's order statuses are:
 *   received | preparing | ready | collected
 */

export type OrderStatus = "received" | "preparing" | "ready" | "collected";

// The three user-generated chibi couriers. One is assigned per customer/order,
// chosen deterministically from the order number so a given customer always
// sees the same courier across status refreshes.
const COURIERS = [
  { body: "/assets/scene/courier-1-walk.png", face: "/assets/scene/courier-1-walk-face.png" },
  { body: "/assets/scene/courier-2-walk.png", face: "/assets/scene/courier-2-walk-face.png" },
  { body: "/assets/scene/courier-3-walk.png", face: "/assets/scene/courier-3-walk-face.png" },
];

function pickCourier(orderNumber: number) {
  const n = Number.isFinite(orderNumber) ? Math.abs(Math.trunc(orderNumber)) : 0;
  return COURIERS[Math.max(0, n - 1) % COURIERS.length];
}

// Which "station" the courier stands at for each status.
const STATION_LEFT: Record<OrderStatus, string> = {
  received: "12.5%",
  preparing: "37.5%",
  ready: "62.5%",
  collected: "87.5%",
};

const STATION_LABELS: Record<OrderStatus, string> = {
  received: "Received", preparing: "Preparing", ready: "Ready", collected: "Collected",
};

// Short courier lines shown in the dialogue box when the status advances.
const DIALOGUE: Record<OrderStatus, string> = {
  received: "Order received! Let me take this to the kitchen, lah!",
  preparing: "Cooking now — smells good already! Hang tight ya.",
  ready: "Your food is ready! Come collect at the stall!",
  collected: "Terima kasih! Jom makan — enjoy your meal!",
};

// Original idle lines: friendly jokes + compliments, shown every 15s while the
// courier is just standing around waiting.
const IDLE_LINES = [
  "You've got great taste — and I'm not just saying that lah!",
  "Waiting is hard, but you're doing it like a champion!",
  "Fun fact: good things come to patient, good-looking people. Like you.",
  "I'd tell you a kitchen joke, but it's still cooking.",
  "You picked the best stall in town. Smart one, you!",
  "Patience level: 100. Hunger level: also 100. Respect!",
  "Why did the noodle blush? It saw you ordering. So charming!",
  "Almost there! Your tummy is going to thank you big time.",
  "You + our food = the perfect combo, confirm!",
  "Standing by… just admiring how well you wait, honestly.",
];

export default function OrderScene({
  status,
  orderNumber,
}: {
  status: OrderStatus;
  orderNumber: number;
}) {
  const [facing, setFacing] = useState<Facing>("right");
  const [walking, setWalking] = useState(true);
  const [left, setLeft] = useState("0%");
  const [dialogue, setDialogue] = useState("");
  const prev = useRef<OrderStatus | null>(null);

  // Walk into the scene on arrival as well as between later status updates.
  // Two animation frames let the browser paint the starting position first.
  useEffect(() => {
    const order: OrderStatus[] = ["received", "preparing", "ready", "collected"];
    const forward = prev.current === null || order.indexOf(status) >= order.indexOf(prev.current);
    setFacing(forward ? "right" : "left");
    setWalking(true);
    setDialogue(DIALOGUE[status]);
    let timer: number | undefined;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        setLeft(STATION_LEFT[status]);
        timer = window.setTimeout(() => {
          setWalking(false);
          setFacing("down");
        }, 1600);
      });
    });
    prev.current = status;
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [status]);

  // Idle chatter: every 15s while not mid-walk, show a random funny/praise line.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!walking) {
        const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
        setDialogue(line + "\u200b"); // zero-width char forces a change even if same line repeats
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [walking]);

  const carrying = status !== "collected";
  const courier = pickCourier(orderNumber);

  return (
    <div className="scene">
      {/* simple panel frame kept minimal per request */}
      <div className="scene-sky" />

      {/* ambient Malaysian animal NPCs (original pixel art) */}
      <img className="npc npc-tapir" src="/assets/scene/tapir.png" alt="" aria-hidden="true" />
      <img className="npc npc-hornbill" src="/assets/scene/hornbill.png" alt="" aria-hidden="true" />
      <img className="npc npc-orangutan" src="/assets/scene/orangutan.png" alt="" aria-hidden="true" />

      {/* station labels */}
      <div className="scene-stations">
        {(Object.keys(STATION_LABELS) as OrderStatus[]).map((station) => (
          <span key={station} aria-current={status === station ? "step" : undefined}>
            {STATION_LABELS[station]}
          </span>
        ))}
      </div>

      {/* courier carrying the order number */}
      <div className="courier" style={{ left }}>
        {carrying && <span className="courier-parcel">#{orderNumber}</span>}
        <CharSprite facing={facing} walking={walking} height={88} sheet={courier.body} />
      </div>

      <div className="scene-ground" />

      {/* dialogue box overlaid INSIDE the scene at the bottom; its reserved
          strip means showing/hiding it never shifts elements below the scene. */}
      <DialogueBox message={dialogue} portrait={courier.face} />
    </div>
  );
}
