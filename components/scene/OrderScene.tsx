"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
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
type OrderItem = { name: string; quantity: number };
type AnimalNpc = "tapir" | "hornbill" | "orangutan";
type Speaker = "courier" | AnimalNpc;

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

// Status lines are selected deterministically from the order number, so each
// customer gets a little personality without the message changing on refresh.
const STATUS_DIALOGUE: Record<OrderStatus, readonly string[]> = {
  received: [
    "Order received! I'm sprinting this ticket to the kitchen, lah!",
    "Got it, kawan! Your food quest has officially begun.",
    "Ticket secured! The kitchen crew is assembling.",
    "Nice pick! I'll make sure the wok gets the message.",
  ],
  preparing: [
    "The kitchen is cooking now — hear that glorious sizzle?",
    "Your order is in the heat of battle. Smells like victory already!",
    "Chef mode: activated. Hang tight, kawan!",
    "Fresh, hot, and on the way. The wok is doing its magic!",
  ],
  ready: [
    "Pickup mission unlocked! Order #{number} is ready at the stall.",
    "Ding ding! Your food has reached maximum deliciousness.",
    "Hot food waiting! Bring pickup number #{number}, kawan.",
    "Quest complete: food ready. Next objective — collect and makan!",
  ],
  collected: [
    "Terima kasih! Quest complete — enjoy every bite!",
    "Order collected. Happiness buff activated!",
    "Jom makan! May your meal be legendary.",
    "Parcel delivered, tummy mission accomplished. See you again!",
  ],
};

// Idle chatter stays relevant to the current stage instead of drawing from one
// generic pool. {number} is replaced with the customer's pickup number.
const IDLE_LINES: Record<OrderStatus, readonly string[]> = {
  received: [
    "Kitchen quest accepted. First objective: tame the hungry tummy.",
    "Your ticket is safe with me — no side quests, promise.",
    "The hornbill is supervising. Very serious quality control.",
    "Good choice, boss. Even the tapir nodded approvingly.",
    "Order #{number} is in the queue and looking confident.",
    "I told the kitchen this one belongs to a VIP. That's you, by the way.",
  ],
  preparing: [
    "Hear that sizzle? That's the soundtrack of progress.",
    "The aroma just walked past me. I nearly followed it.",
    "Chef says 'almost.' My stomach says 'now.' We trust the chef.",
    "Your meal is gaining flavour points by the second.",
    "No microwave shortcuts here, kawan. Proper cooking takes a moment.",
    "The orangutan asked for a taste. Request respectfully denied.",
    "Patience level: heroic. Hunger level: understandable.",
    "Order #{number} is currently receiving the delicious treatment.",
  ],
  ready: [
    "Your food is waiting like treasure at the end of a quest.",
    "Show number #{number} at the stall and claim your tasty reward!",
    "Come while it's hot — the steam is doing a little victory dance.",
    "Ready means ready, kawan. Time to make that stomach happy.",
    "The tapir wanted to collect it for you. I said you'd handle it.",
    "Your order looks so good I'm practising professional self-control.",
  ],
  collected: [
    "Quest complete. May every bite land a critical hit.",
    "Food acquired. Happiness buff should begin immediately.",
    "See you on the next makan mission, kawan!",
    "The hornbill says goodbye. The tapir is still thinking about your food.",
    "Thank you for visiting our little stall adventure!",
    "Final status: collected. Next status: sedap.",
  ],
};

const ANIMAL_NPCS: Record<AnimalNpc, { name: string; image: string }> = {
  tapir: { name: "tapir", image: "/assets/scene/tapir.png" },
  hornbill: { name: "hornbill", image: "/assets/scene/hornbill.png" },
  orangutan: { name: "orangutan", image: "/assets/scene/orangutan.png" },
};

const ANIMAL_DIALOGUE: Record<AnimalNpc, Record<OrderStatus, readonly string[]>> = {
  tapir: {
    received: [
      "Tapir: I heard an order arrive. Was it snacks? Please say snacks.",
      "Tapir: Order #{number} has entered the forest of delicious possibilities.",
      "Tapir: Excellent choice. I approve with my entire stripey heart.",
    ],
    preparing: [
      "Tapir: That smell... I am staying here for scientific reasons.",
      "Tapir: The cooking aroma has reached maximum tapir range.",
      "Tapir: I can wait patiently. Probably. Maybe. Is it ready yet?",
    ],
    ready: [
      "Tapir: It's ready! If you walk slowly, I may volunteer to collect it.",
      "Tapir: Order #{number} is calling your name. Also my name, somehow.",
      "Tapir: Hot food alert! Protect it from suspiciously hungry wildlife.",
    ],
    collected: [
      "Tapir: Gone already? A beautiful meal, remembered forever.",
      "Tapir: Mission complete. I accept thank-you snacks.",
      "Tapir: Enjoy! I will be over here imagining the leftovers.",
    ],
  },
  hornbill: {
    received: [
      "Hornbill: Order logged. Beak Inspection Department is now on duty.",
      "Hornbill: Ticket #{number} confirmed. Queue discipline: excellent.",
      "Hornbill: I have surveyed the kitchen. Operations are proceeding nicely.",
    ],
    preparing: [
      "Hornbill: Sizzle levels are within delicious operating limits.",
      "Hornbill: Quality report: aroma strong, patience recommended.",
      "Hornbill: The kitchen passes inspection. I shall continue observing.",
    ],
    ready: [
      "Hornbill: Official announcement — order #{number} is ready for pickup!",
      "Hornbill: Final inspection passed. Please proceed to the stall.",
      "Hornbill: Wings up! Your meal is cleared for collection.",
    ],
    collected: [
      "Hornbill: Collection confirmed. Case closed with delicious results.",
      "Hornbill: Thank you, citizen. Your makan paperwork is complete.",
      "Hornbill: Excellent pickup technique. Ten out of ten.",
    ],
  },
  orangutan: {
    received: [
      "Orangutan: New order! I promise not to press every kitchen button.",
      "Orangutan: Order #{number}? Nice. That is a very lucky number today.",
      "Orangutan: I told the chef to make it extra legendary.",
    ],
    preparing: [
      "Orangutan: I offered to help stir. For some reason, they said no.",
      "Orangutan: The wok is doing tricks! Okay, normal cooking tricks.",
      "Orangutan: Almost there. I checked twice. Then I got distracted.",
    ],
    ready: [
      "Orangutan: Food ready! Race you to the stall — safely, of course.",
      "Orangutan: Order #{number} unlocked the Delicious Ending!",
      "Orangutan: Quick, collect it before the tapir starts negotiating.",
    ],
    collected: [
      "Orangutan: High five! Another makan adventure completed.",
      "Orangutan: Come back soon. I will prepare more excellent commentary.",
      "Orangutan: You got the food! Best plot twist ever.",
    ],
  },
};

const READY_CONFETTI = [
  { x: "-128px", y: "-75px", r: "-160deg", color: "#f0a830", delay: "0ms" },
  { x: "-96px", y: "-110px", r: "120deg", color: "#3fb6c4", delay: "60ms" },
  { x: "-58px", y: "-88px", r: "210deg", color: "#e15c64", delay: "100ms" },
  { x: "-22px", y: "-125px", r: "-90deg", color: "#f5dc68", delay: "30ms" },
  { x: "22px", y: "-120px", r: "155deg", color: "#7ac45b", delay: "80ms" },
  { x: "58px", y: "-92px", r: "-220deg", color: "#f0a830", delay: "20ms" },
  { x: "96px", y: "-112px", r: "130deg", color: "#3fb6c4", delay: "120ms" },
  { x: "130px", y: "-70px", r: "240deg", color: "#e15c64", delay: "50ms" },
  { x: "-112px", y: "-25px", r: "90deg", color: "#7ac45b", delay: "130ms" },
  { x: "-66px", y: "-35px", r: "-120deg", color: "#f5dc68", delay: "170ms" },
  { x: "70px", y: "-32px", r: "180deg", color: "#f5dc68", delay: "150ms" },
  { x: "116px", y: "-22px", r: "-145deg", color: "#7ac45b", delay: "190ms" },
] as const;

function formatDialogue(line: string, orderNumber: number): string {
  return line.replaceAll("{number}", String(orderNumber));
}

function statusDialogue(status: OrderStatus, orderNumber: number): string {
  const options = STATUS_DIALOGUE[status];
  const statusIndex = (Object.keys(STATUS_DIALOGUE) as OrderStatus[]).indexOf(status);
  const seed = Math.abs(Math.trunc(orderNumber)) + statusIndex;
  return formatDialogue(options[seed % options.length], orderNumber);
}

const FOOD_IMAGES: Record<string, string> = {
  indomie: "/images/indomie.webp",
  "indomie with egg": "/images/indomie-egg.webp",
  "roti canai": "/images/roti-canai.webp",
  "teh o limau ais": "/images/teh-o-limau-ais.webp",
  milo: "/images/milo.webp",
};

function foodImage(name: string): string | null {
  return FOOD_IMAGES[name.trim().toLowerCase()] ?? null;
}

export default function OrderScene({
  status,
  orderNumber,
  items,
}: {
  status: OrderStatus;
  orderNumber: number;
  items: OrderItem[];
}) {
  const [facing, setFacing] = useState<Facing>("right");
  const [walking, setWalking] = useState(true);
  const [left, setLeft] = useState("0%");
  const [dialogue, setDialogue] = useState("");
  const [speaker, setSpeaker] = useState<Speaker>("courier");
  const prev = useRef<OrderStatus | null>(null);
  const lastIdleLine = useRef("");
  const animalLineIndex = useRef<Record<AnimalNpc, number>>({
    tapir: 0,
    hornbill: 0,
    orangutan: 0,
  });

  // Walk into the scene on arrival as well as between later status updates.
  // Two animation frames let the browser paint the starting position first.
  useEffect(() => {
    const order: OrderStatus[] = ["received", "preparing", "ready", "collected"];
    const forward = prev.current === null || order.indexOf(status) >= order.indexOf(prev.current);
    setFacing(forward ? "right" : "left");
    setWalking(true);
    setSpeaker("courier");
    setDialogue(statusDialogue(status, orderNumber));
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
  }, [orderNumber, status]);

  // Idle chatter: every 15s while not mid-walk, show a random funny/praise line.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!walking) {
        const options = IDLE_LINES[status];
        let index = Math.floor(Math.random() * options.length);
        if (options[index] === lastIdleLine.current) {
          index = (index + 1) % options.length;
        }
        const line = formatDialogue(options[index], orderNumber);
        lastIdleLine.current = options[index];
        setSpeaker("courier");
        setDialogue(line + "\u200b"); // zero-width char forces a typewriter replay
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [orderNumber, status, walking]);

  const carrying = status !== "collected";
  const courier = pickCourier(orderNumber);
  const portrait = speaker === "courier" ? courier.face : ANIMAL_NPCS[speaker].image;

  function talkToAnimal(animal: AnimalNpc) {
    const options = ANIMAL_DIALOGUE[animal][status];
    const index = animalLineIndex.current[animal] % options.length;
    animalLineIndex.current[animal] += 1;
    setSpeaker(animal);
    setDialogue(formatDialogue(options[index], orderNumber) + "\u200b");
  }

  return (
    <div className={`scene scene-${status}`}>
      {/* simple panel frame kept minimal per request */}
      <div className="scene-sky" />

      {status === "received" && (
        <div className="received-effect" aria-hidden="true">
          <span>#{orderNumber}</span>
        </div>
      )}
      {status === "preparing" && (
        <div className="preparing-effect" aria-hidden="true">
          <span /><span /><span />
        </div>
      )}
      {status === "ready" && <div className="ready-ding" aria-hidden="true">DING!</div>}
      {status === "collected" && (
        <div className="collected-stamp" aria-hidden="true">COLLECTED ✓</div>
      )}

      {/* Interactive Malaysian animal NPCs (original pixel art). */}
      {(Object.keys(ANIMAL_NPCS) as AnimalNpc[]).map((animal) => (
        <button
          key={animal}
          className={`npc npc-${animal}`}
          type="button"
          aria-label={`Talk to the ${ANIMAL_NPCS[animal].name}`}
          title={`Talk to the ${ANIMAL_NPCS[animal].name}`}
          onClick={() => talkToAnimal(animal)}
        >
          <img className="npc-sprite" src={ANIMAL_NPCS[animal].image} alt="" />
        </button>
      ))}

      {status === "ready" && (
        <div className="ready-celebration" aria-hidden="true">
          {READY_CONFETTI.map((piece, index) => (
            <span
              key={index}
              style={{
                "--confetti-x": piece.x,
                "--confetti-y": piece.y,
                "--confetti-rotation": piece.r,
                "--confetti-color": piece.color,
                "--confetti-delay": piece.delay,
              } as CSSProperties}
            />
          ))}
        </div>
      )}

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
        {carrying && items.length > 0 && (
          <div
            className="courier-order-preview"
            aria-label={`Order items: ${items.map((item) => `${item.quantity} ${item.name}`).join(", ")}`}
          >
            {items.slice(0, 3).map((item, index) => {
              const image = foodImage(item.name);
              return image ? (
                <span className="courier-order-item" key={`${item.name}-${index}`} title={`${item.quantity} × ${item.name}`}>
                  <img src={image} alt="" />
                  {item.quantity > 1 && <b>{item.quantity}</b>}
                </span>
              ) : null;
            })}
            {items.length > 3 && <span className="courier-order-more">+{items.length - 3}</span>}
          </div>
        )}
        {carrying && <span className="courier-parcel">#{orderNumber}</span>}
        <CharSprite facing={facing} walking={walking} height={88} sheet={courier.body} />
      </div>

      <div className="scene-ground" />

      {/* dialogue box overlaid INSIDE the scene at the bottom; its reserved
          strip means showing/hiding it never shifts elements below the scene. */}
      <DialogueBox
        message={dialogue}
        portrait={portrait}
        portraitFit={speaker === "courier" ? "cover" : "contain"}
      />
    </div>
  );
}
