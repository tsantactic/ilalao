"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { startEnemyBot } from "../../lib/enemyBot";
import { useRouter, useSearchParams } from "next/navigation";

type SavedGame = { id: number; name: string; owner: string; data: any; createdAt: string };

export default function GamePage() {
  const [games, setGames] = useState<SavedGame[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // map state
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const VIRTUAL_WIDTH = 2000;
  const VIRTUAL_HEIGHT = 2000;
  const MINIMAP_SIZE = 220;
  const MINIMAP_PADDING = 12;
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const NUM_SEGMENTS = 2;
  const [captureSegments, setCaptureSegments] = useState<Array<null | "player" | "enemy">>(() => Array(NUM_SEGMENTS).fill(null));
  const [gameWinner, setGameWinner] = useState<null | "player" | "enemy">(null);
  const [controlPct, setControlPct] = useState<{ player: number; enemy: number }>({ player: 0, enemy: 0 });
  const [trees, setTrees] = useState<Array<{ x: number; y: number }>>([]);
  // structures placed on the map
  const [structures, setStructures] = useState<Array<{ type: string; x: number; y: number; comment?: string; hp?: number; owner?: string }>>([]);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [troops, setTroops] = useState<Array<{ id: number; type: string; x: number; y: number; hp: number; owner?: string; target?: { x: number; y: number } | { structureIndex: number } | { troopId: number } }>>([]);
  const [projectiles, setProjectiles] = useState<Array<{ id: number; kind: "missile" | "nuke" | "bullet"; fromX: number; fromY: number; toX: number; toY: number; startTime: number; duration: number }>>([]);
  const [explosions, setExplosions] = useState<Array<{ id: number; x: number; y: number; radius: number; start: number }>>([]);
  const [weaponsStock, setWeaponsStock] = useState<{ missile: number; nuke: number }>({ missile: 0, nuke: 0 });
  const [lastLauncherIndex, setLastLauncherIndex] = useState<number | null>(null);
  const missileDamage = 20;
  const nukeDamage = 120;
  const bulletDamage = 12;
  const MISSILE_TRUCK_RANGE = 300;
  const MAISON_DEFENSE_RANGE = 360;
  // selection rectangle state (canvas pixel coords)
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  function cancelWeaponTargeting() {
    setWeaponTargetMode(null);
    setStatus("Ciblage annulé");
  }
  function cancelWeaponPending(id?: number) {
    // cancel a single pending by id, or all if id omitted
    if (id == null) {
      // cancel all
      setWeaponPendings((prev) => {
        prev.forEach((p) => {
          try {
            if (p.timerId) window.clearTimeout(p.timerId as unknown as number);
          } catch (e) {}
          setWeaponsStock((w) => ({ ...w, [p.kind]: ((w as any)[p.kind] || 0) + 1 }));
        });
        return [];
      });
      setStatus("Tous les tirs annulés");
      return;
    }
    setWeaponPendings((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) {
        try {
          if (found.timerId) window.clearTimeout(found.timerId as unknown as number);
        } catch (e) {}
        setWeaponsStock((w) => ({ ...w, [found.kind]: ((w as any)[found.kind] || 0) + 1 }));
      }
      return prev.filter((p) => p.id !== id);
    });
    setStatus("Tir annulé");
  }
  const [selectedTroopIds, setSelectedTroopIds] = useState<number[]>([]);
  const [weaponTargetMode, setWeaponTargetMode] = useState<{ kind: "missile" | "nuke" | null } | null>(null);
  const [weaponPendings, setWeaponPendings] = useState<Array<{ id: number; kind: "missile" | "nuke"; target?: { x: number; y: number }; timerId?: number }>>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const nextIds = useRef({ troop: 1 });
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [clickedLabel, setClickedLabel] = useState<string | null>(null);
  const [clickedCursorPos, setClickedCursorPos] = useState<{ x: number; y: number } | null>(null);
  const clickLabelTimeout = useRef<number | null>(null);
  const [showCommentPrompt, setShowCommentPrompt] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<{ x: number; y: number; type: string } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [selectedStructureIndex, setSelectedStructureIndex] = useState<number | null>(null);
  const availableBuildings = [
    { key: "maison_troupe", label: "Maison de troupe" },
    { key: "maison_mine", label: "Maison de mine" },
    { key: "maison_missile", label: "Maison de missile" },
    { key: "maison_defense", label: "Maison de défense" },
    { key: "maison_nucleaire", label: "Maison de bombe nucléaire" },
  ];
  const structurePrices: Record<string, { gold: number; iron: number; petrol?: number; wood?: number }> = {
    maison_centrale: { gold: 0, iron: 0 },
    maison_troupe: { gold: 0, iron: 0 },
    // mine costs set to 5 gold / 5 iron / 5 wood as requested
    maison_mine: { gold: 5, iron: 5, wood: 5 },
    maison_missile: { gold: 0, iron: 0 },
    // defense turret against missiles/nukes
    maison_defense: { gold: 60, iron: 30 },
    maison_nucleaire: { gold: 0, iron: 0 },
    maison_enemy: { gold: 0, iron: 0 },
  };
  const [rightSelectedBuilding, setRightSelectedBuilding] = useState<string | null>(null);
  const [hoveredStructureIndex, setHoveredStructureIndex] = useState<number | null>(null);
  const [hoveredStructureScreenPos, setHoveredStructureScreenPos] = useState<{ x: number; y: number } | null>(null);
  // resources and workers
  const [resources, setResources] = useState({ wood: 0, gold: 0, iron: 0, petrol: 0 });
  const production = useRef({ gold: 1, iron: 0.5, petrol: 0.2 }); // base per second
  const [workers, setWorkers] = useState<Array<{ id: number; life: number; busy?: boolean }>>([{ id: 1, life: 10, busy: false }]);
  // enemy bot resources and logs
  const [enemyResources, setEnemyResources] = useState({ wood: 40, gold: 80, iron: 40, petrol: 0 });
  const enemyStructureCosts: Record<string, { gold: number; iron: number }> = {
    maison_centrale: { gold: 0, iron: 0 },
    maison_troupe: { gold: 60, iron: 20 },
    maison_mine: { gold: 40, iron: 10 },
    maison_missile: { gold: 100, iron: 40 },
    maison_nucleaire: { gold: 180, iron: 90 },
    maison_enemy: { gold: 0, iron: 0 },
  };
  const [logMessages, setLogMessages] = useState<string[]>([]);
  function pushLog(msg: string) {
    setLogMessages((l) => {
      const next = [msg, ...l];
      return next.slice(0, 12);
    });
  }

  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateTrees(seedNum: number) {
    const rnd = mulberry32(seedNum);
    const arr: Array<{ x: number; y: number }> = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      arr.push({ x: Math.floor(rnd() * VIRTUAL_WIDTH), y: Math.floor(rnd() * VIRTUAL_HEIGHT) });
    }
    return arr;
  }

  function clampOffset(x: number, y: number, viewW: number, viewH: number) {
    const minX = Math.min(0, VIRTUAL_WIDTH - viewW);
    const maxX = Math.max(0, VIRTUAL_WIDTH - viewW);
    const minY = Math.min(0, VIRTUAL_HEIGHT - viewH);
    const maxY = Math.max(0, VIRTUAL_HEIGHT - viewH);
    return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
  }

  function drawMap() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // clear viewport
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw virtual map translated by offset and scaled
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-offset.x, -offset.y);
    // base
    ctx.fillStyle = "#3CA33C";
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    // decorative darker patches
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let i = 0; i < 50; i++) {
      const x = (i * 77) % VIRTUAL_WIDTH;
      const y = (i * 131) % VIRTUAL_HEIGHT;
      const r = 20 + (i % 5) * 6;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // draw trees (pseudo-3D layered foliage)
    for (const t of trees) {
      // trunk
      ctx.fillStyle = "#6b3b1f";
      ctx.fillRect(t.x - 3, t.y, 6, 18);
      // layered foliage with slight offset for depth
      const colors = ["#1b5e20", "#238a3b", "#2ea24a"];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.fillStyle = colors[i];
        const ry = 12 - i * 4;
        ctx.ellipse(t.x - i * 2, t.y - 6 - i * 8, 14 - i * 3, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // soft shadow
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.ellipse(t.x + 6, t.y + 18, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
      // draw placed structures (more detailed)
      for (const s of structures) {
        const x = s.x;
        const y = s.y;
        // common shadow
        ctx.beginPath();
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.ellipse(x + 8, y + 18, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if (s.type === "maison_centrale") {
          // base
          ctx.fillStyle = "#5d4037";
          ctx.fillRect(x - 40, y - 10, 80, 30);
          // mid
          ctx.fillStyle = "#8d6e63";
          ctx.fillRect(x - 25, y - 30, 50, 20);
          // roof
          ctx.beginPath();
          ctx.moveTo(x - 32, y - 30);
          ctx.lineTo(x, y - 55);
          ctx.lineTo(x + 32, y - 30);
          ctx.closePath();
          ctx.fillStyle = "#b71c1c";
          ctx.fill();
        } else if (s.type === "maison_mine") {
          // mine building
          ctx.fillStyle = "#424242";
          ctx.fillRect(x - 30, y - 20, 60, 40);
          // cart
          ctx.fillStyle = "#795548";
          ctx.fillRect(x + 28, y - 6, 18, 12);
          ctx.fillStyle = "#ffd54f";
          ctx.fillRect(x + 30, y - 2, 12, 6);
        } else if (s.type === "maison_troupe") {
          // barracks
          ctx.fillStyle = "#2e7d32";
          ctx.fillRect(x - 45, y - 18, 90, 36);
          // door
          ctx.fillStyle = "#111";
          ctx.fillRect(x - 12, y - 4, 24, 28);
        } else if (s.type === "maison_missile") {
          // silo base (circle)
          ctx.fillStyle = "#546e7a";
          ctx.beginPath();
          ctx.ellipse(x, y - 8, 28, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          // tower
          ctx.fillStyle = "#cfd8dc";
          ctx.fillRect(x - 10, y - 70, 20, 50);
          ctx.fillStyle = "#d32f2f";
          ctx.fillRect(x - 11, y - 78, 22, 8);
        } else if (s.type === "maison_defense") {
          // anti-missile turret (multi-barrel)
          // base
          ctx.fillStyle = "#37474f";
          ctx.beginPath();
          ctx.ellipse(x, y - 6, 34, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          // turret body
          ctx.fillStyle = "#90a4ae";
          ctx.fillRect(x - 18, y - 36, 36, 24);
          // barrels (draw 4 small barrels)
          const now = performance.now();
          const fired = (s as any).lastFired ? now - (s as any).lastFired < 400 : false;
          for (let i = 0; i < 4; i++) {
            const bx = x - 18 + 9 * i;
            ctx.fillStyle = "#263238";
            ctx.fillRect(bx, y - 50, 4, 14);
            // muzzle flash when recently fired
            if (fired) {
              ctx.beginPath();
              ctx.fillStyle = "rgba(255,215,64,0.9)";
              ctx.arc(bx + 2, y - 54, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (s.type === "maison_nucleaire") {
          // bunker
          ctx.fillStyle = "#263238";
          ctx.fillRect(x - 36, y - 14, 72, 28);
          // core
          ctx.fillStyle = "#00c853";
          ctx.fillRect(x - 20, y - 30, 40, 16);
          // top plate
          ctx.fillStyle = "#455a64";
          ctx.fillRect(x - 40, y - 36, 80, 8);
        } else if (s.type === "maison_enemy") {
          ctx.fillStyle = "#1f2937";
          ctx.fillRect(x - 38, y - 18, 76, 36);
          ctx.fillStyle = "#111827";
          ctx.fillRect(x - 18, y - 6, 36, 24);
        } else {
          // default small house
          ctx.fillStyle = "#d6a36a";
          ctx.fillRect(x - 24, y - 14, 48, 28);
          ctx.beginPath();
          ctx.moveTo(x - 26, y - 14);
          ctx.lineTo(x, y - 34);
          ctx.lineTo(x + 26, y - 14);
          ctx.closePath();
          ctx.fillStyle = "#8b1f1f";
          ctx.fill();
        }

        // health bar
        const hp = s.hp ?? 100;
        const barW = 50;
        const barX = x - barW / 2;
        const barY = y - 30;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, 8 + 2);
        ctx.fillStyle = "#555";
        ctx.fillRect(barX, barY, barW, 8);
        ctx.fillStyle = "#55ff55";
        const pct = Math.max(0, Math.min(1, hp / 100));
        ctx.fillRect(barX, barY, barW * pct, 8);
        if (s.comment) {
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.font = "12px sans-serif";
          ctx.fillText(s.comment, x + 18, y - 18);
        }
      }
    // draw troops with improved shapes
    for (const t of troops) {
      const tx = t.x;
      const ty = t.y;
      const owner = (t as any).owner === "enemy" ? "enemy" : "player";
      if (t.type === "soldat") {
        // body
        ctx.fillStyle = owner === "enemy" ? "#b91c1c" : "#1976d2";
        ctx.fillRect(tx - 6, ty - 6, 12, 14);
        // head
        ctx.beginPath();
        ctx.fillStyle = "#ffdbb5";
        ctx.arc(tx, ty - 12, 5, 0, Math.PI * 2);
        ctx.fill();
        // weapon
        ctx.fillStyle = "#222";
        ctx.fillRect(tx + 6, ty - 2, 10, 3);
      } else if (t.type === "sniper") {
        ctx.fillStyle = owner === "enemy" ? "#7c2d5d" : "#0ea5e9";
        ctx.fillRect(tx - 6, ty - 6, 12, 14);
        ctx.beginPath(); ctx.fillStyle = "#1f2937"; ctx.arc(tx, ty - 12, 4, 0, Math.PI * 2); ctx.fill();
        // long rifle
        ctx.fillStyle = "#000";
        ctx.fillRect(tx + 8, ty - 4, 20, 3);
      } else if (t.type === "tank") {
        // tracks
        ctx.fillStyle = "#3e2723";
        ctx.fillRect(tx - 16, ty - 2, 32, 12);
        // turret
        ctx.fillStyle = owner === "enemy" ? "#7f1d1d" : "#33691e";
        ctx.fillRect(tx - 10, ty - 18, 20, 14);
        // cannon
        ctx.fillStyle = "#1b5e20";
        ctx.fillRect(tx + 10, ty - 12, 18, 6);
      } else if (t.type === "drone") {
        // small healer drone (glowing)
        ctx.beginPath();
        ctx.fillStyle = "rgba(16,185,129,0.95)";
        ctx.arc(tx, ty - 6, 8, 0, Math.PI * 2);
        ctx.fill();
        // propellers
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(tx - 14, ty - 12, 6, 2);
        ctx.fillRect(tx + 8, ty - 12, 6, 2);
      } else {
        // default circular marker
        ctx.beginPath();
        ctx.fillStyle = owner === "enemy" ? "#e11d48" : "#f59e0b";
        ctx.arc(tx, ty - 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // hp bar
      const mh = troopStats[t.type]?.hp ?? 100;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(tx - 10, ty + 6, 20, 4);
      ctx.fillStyle = "#4caf50";
      ctx.fillRect(tx - 10, ty + 6, (20 * Math.max(0, Math.min(1, t.hp / mh))), 4);
      // selection ring
      if (selectedTroopIds.includes(t.id)) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0,120,255,0.9)";
        ctx.lineWidth = 2;
        ctx.arc(tx, ty - 6, (troopStats[t.type]?.size ?? 6) + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // draw projectiles
    // draw firing zones for defenses and missile trucks
    for (const s of structures) {
      if (s.type === "maison_defense") {
        const r = MAISON_DEFENSE_RANGE;
        ctx.beginPath();
        ctx.fillStyle = "rgba(59,130,246,0.06)"; // blueish fill
        ctx.strokeStyle = "rgba(59,130,246,0.28)";
        ctx.lineWidth = 1;
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    for (const t of troops) {
      if (t.type === "missile_truck") {
        const r = MISSILE_TRUCK_RANGE;
        ctx.beginPath();
        ctx.fillStyle = "rgba(59,130,246,0.04)";
        ctx.strokeStyle = "rgba(59,130,246,0.22)";
        ctx.lineWidth = 1;
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const p of projectiles) {
      const now = performance.now();
      const t = Math.min(1, (now - p.startTime) / p.duration);
      const x = p.fromX + (p.toX - p.fromX) * t;
      const y = p.fromY + (p.toY - p.fromY) * t;
      // draw trail
      ctx.beginPath();
      ctx.fillStyle = p.kind === "nuke" ? "rgba(255,120,0,0.9)" : "rgba(200,200,200,0.95)";
      ctx.arc(x, y, p.kind === "nuke" ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
      // small flame
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,200,0,0.9)";
      ctx.arc(x + 4, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // draw explosions
    for (const ex of explosions) {
      const now = performance.now();
      const age = now - ex.start;
      const life = 1000;
      const prog = Math.min(1, age / life);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,140,0,${0.6 * (1 - prog)})`;
      ctx.arc(ex.x, ex.y, ex.radius * prog, 0, Math.PI * 2);
      ctx.fill();
    }
    // draw selection rectangle (screen space) if any
    if (selectionRect) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,120,255,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      ctx.setLineDash([]);
    }
    // draw pending weapon target markers
    for (const wp of weaponPendings) {
      if (!wp.target) continue;
      const tx = wp.target.x;
      const ty = wp.target.y;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,0,0,0.9)";
      ctx.lineWidth = 2;
      ctx.arc(tx, ty, wp.kind === "nuke" ? 36 : 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    // draw preview if any
    if (previewPos && selectedStructure) {
      const s = previewPos;
      const w = 48;
      const h = 40;
      ctx.save();
      ctx.globalAlpha = 0.6;
      // translucent 3D preview (front face)
      ctx.fillStyle = "#d6a36a";
      ctx.fillRect(s.x - w / 2, s.y - h / 2, w, h);
      // roof
      ctx.beginPath();
      ctx.moveTo(s.x - w / 2, s.y - h / 2);
      ctx.lineTo(s.x, s.y - h);
      ctx.lineTo(s.x + w / 2 + 6, s.y - h / 2 + 6);
      ctx.closePath();
      ctx.fillStyle = "#8b1f1f";
      ctx.fill();
      ctx.restore();
    }
      ctx.restore();
      // hovered label (screen space) - top left
      if (hoveredLabel) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.font = "14px sans-serif";
        ctx.fillText(hoveredLabel, 10, 25);
      }

      // clicked object label near cursor (screen space)
      if (clickedLabel && clickedCursorPos) {
        const tx = clickedCursorPos.x + 12;
        const ty = clickedCursorPos.y + 12;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.font = "13px sans-serif";
        const w = ctx.measureText(clickedLabel).width + 8;
        ctx.fillRect(tx - 4, ty - 14, w, 18);
        ctx.fillStyle = "white";
        ctx.fillText(clickedLabel, tx, ty);
      }

      // hovered-structure label: if hovering a structure, draw its name near the structure
      if (hoveredStructureIndex !== null && hoveredStructureScreenPos) {
        const s = structures[hoveredStructureIndex];
        if (s) {
          const name = s.type === "maison_centrale" ? "Maison centrale" : s.type.replace(/_/g, " ");
          const tx = hoveredStructureScreenPos.x + 12;
          const ty = hoveredStructureScreenPos.y + 12;
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.font = "13px sans-serif";
          const w = ctx.measureText(name).width + 8;
          ctx.fillRect(tx - 4, ty - 14, w, 18);
          ctx.fillStyle = "white";
          ctx.fillText(name, tx, ty);
        }
      }

      // minimap is drawn in the left sidebar mini-canvas
  }

  useEffect(() => {
    if (!gameWinner) return;
    setStatus(gameWinner === "player" ? "Victoire ! Vous avez pris toute la ligne" : "Défaite : le bot a pris toute la ligne");
    // optionally: stop enemy actions by clearing structures? For now just notify
  }, [gameWinner]);
    // draw minimap into separate miniCanvasRef
    useEffect(() => {
    function drawMini() {
      const c = miniCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const miniW = c.width;
      const miniH = c.height;
      // background
      ctx.clearRect(0, 0, miniW, miniH);
      ctx.fillStyle = "rgba(245,245,245,0.95)";
      ctx.fillRect(0, 0, miniW, miniH);
      // draw capture segments as vertical strips
      const segW = miniW / NUM_SEGMENTS;
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const owner = captureSegments[i];
        if (owner === "player") ctx.fillStyle = "rgba(37,99,235,0.18)";
        else if (owner === "enemy") ctx.fillStyle = "rgba(220,38,38,0.18)";
        else ctx.fillStyle = "rgba(0,0,0,0.02)";
        ctx.fillRect(i * segW, 0, segW, miniH);
      }
      // draw trees
      ctx.fillStyle = "#1b5e20";
      for (const t of trees) {
        const tx = (t.x / VIRTUAL_WIDTH) * miniW;
        const ty = (t.y / VIRTUAL_HEIGHT) * miniH;
        ctx.fillRect(tx - 1, ty - 1, 2, 2);
      }
      // draw structures (player blue, enemy red)
      for (const s of structures) {
        const sx = (s.x / VIRTUAL_WIDTH) * miniW;
        const sy = (s.y / VIRTUAL_HEIGHT) * miniH;
        if ((s as any).owner === "enemy") ctx.fillStyle = "#b91c1c";
        else ctx.fillStyle = "#1e3a8a";
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
      // draw troops
      for (const t of troops) {
        const tx = (t.x / VIRTUAL_WIDTH) * miniW;
        const ty = (t.y / VIRTUAL_HEIGHT) * miniH;
        ctx.fillStyle = (t as any).owner === "enemy" ? "#7f1d1d" : "#0ea5e9";
        ctx.fillRect(tx - 2, ty - 2, 4, 4);
      }
      // draw viewport rect
      const viewW = (canvasRef.current?.width || 800) / scale;
      const viewH = (canvasRef.current?.height || 600) / scale;
      const vx = (offset.x / VIRTUAL_WIDTH) * miniW;
      const vy = (offset.y / VIRTUAL_HEIGHT) * miniH;
      const vw = (viewW / VIRTUAL_WIDTH) * miniW;
      const vh = (viewH / VIRTUAL_HEIGHT) * miniH;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
    }
    drawMini();
    const ii = setInterval(drawMini, 500);
    return () => clearInterval(ii);
  }, [trees, structures, troops, offset, scale, captureSegments]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 1600;
      canvas.height = 1200;
    }
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      fetchGames(user.email);
    }
    // if load param present, fetch game and set seed
    const load = searchParams?.get("load");
        if (load) {
      const id = Number(load);
      if (!Number.isNaN(id)) {
        fetch(`/api/game/get?id=${id}`).then((r) => r.json()).then((d) => {
          if (d?.success && d.game) {
            const s = d.game.data?.seed ?? Date.now();
            setSeed(Number(s));
            setTrees(generateTrees(Number(s)));
                setGameName(d.game.name || "");
                // load structures if present
                setStructures((d.game.data?.structures || []).map((it: any) => ({ hp: 100, weapons: (it.weapons || {}), ...it })));
                // load resources/workers/troops if present
                if (d.game.data?.resources) setResources(d.game.data.resources);
                if (d.game.data?.workers) setWorkers(d.game.data.workers);
                if (d.game.data?.troops) setTroops(d.game.data.troops);
                if (d.game.data?.weaponsStock) setWeaponsStock(d.game.data.weaponsStock);
            setStatus(`Partie chargée: ${d.game.name}`);
          }
        }).catch(() => {});
      }
    } else {
      // default generation
      setTrees(generateTrees(seed));
      // ensure an enemy house exists
      setStructures((s) => {
        const hasEnemy = s.find((z) => z.type === "maison_enemy");
        if (hasEnemy) return s;
        return [...s, { type: "maison_enemy", x: VIRTUAL_WIDTH - 220, y: VIRTUAL_HEIGHT - 220, comment: "Base ennemie", hp: 150, owner: "enemy", weapons: {} } as any];
      });
      // if no name provided, prompt user to enter a name after clicking Jouer from home
      setShowNamePrompt(true);
    }
    // autosave current session locally and attempt server save if possible
    const auto = () => {
      try {
        const payload = { seed, structures, resources, workers, troops, weaponsStock };
        localStorage.setItem("autosave_game", JSON.stringify(payload));
      } catch (e) {}
      const raw = localStorage.getItem("user");
      if (raw && gameName && gameName.trim().length > 0) {
        // try server save (non-blocking)
        setTimeout(() => {
          handleSave();
        }, 1500);
      }
    };
    auto();
    const autosaveInterval = setInterval(auto, 15000);
    return () => clearInterval(autosaveInterval);
  }, []);

  async function fetchGames(owner: string) {
    try {
      const res = await fetch(`/api/game/list?owner=${encodeURIComponent(owner)}`);
      const data = await res.json();
      if (res.ok) setGames(data.games || []);
    } catch (e) {}
  }

  async function handleSave() {
    setStatus(null);
    const raw = localStorage.getItem("user");
    if (!raw) return setStatus("Utilisateur non connecté");
    const user = JSON.parse(raw);
    if (!gameName || gameName.trim().length === 0) return setStatus("Donne un nom à la partie avant de sauvegarder");
    // include resources, workers, troops and weapon stock in save
    const gameData: any = { map: "green_base", seed, structures, resources, workers, troops };
    gameData.weaponsStock = weaponsStock;
    const res = await fetch("/api/game/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: gameName, owner: user.email, data: gameData }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(data.updated ? "Partie mise à jour" : "Partie sauvegardée");
      fetchGames(user.email);
    } else setStatus(data?.error || "Erreur");
  }

  function handleQuit() {
    router.push("/home");
  }

  async function handleDelete(id: number) {
    const raw = localStorage.getItem("user");
    if (!raw) return setStatus("Utilisateur non connecté");
    const user = JSON.parse(raw);
    const res = await fetch("/api/game/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, owner: user.email }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("Partie supprimée");
      fetchGames(user.email);
    } else setStatus(data?.error || "Erreur");
  }

  // panning handlers
  function toCanvasPos(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    if (!canvas) return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // account for CSS scaling of canvas: map client coords to canvas pixel coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const worldBeforeX = offset.x + px / scale;
    const worldBeforeY = offset.y + py / scale;
    const delta = -Math.sign(e.deltaY);
    const factor = delta > 0 ? 1.12 : 0.88;
    const next = Math.max(0.5, Math.min(3, scale * factor));
    setScale(next);
    // keep world point under cursor stable
    const newOffsetX = worldBeforeX - px / next;
    const newOffsetY = worldBeforeY - py / next;
    const viewW = canvas.width / next;
    const viewH = canvas.height / next;
    const cl = clampOffset(newOffsetX, newOffsetY, viewW, viewH);
    setOffset(cl);
  }

  function handleMouseDown(e: React.MouseEvent) {
    const canvasPos = toCanvasPos(e);
    // if Shift held -> start rectangle selection
    if (e.shiftKey) {
      setIsSelecting(true);
      selectionStart.current = { x: canvasPos.x, y: canvasPos.y };
      setSelectionRect({ x: canvasPos.x, y: canvasPos.y, w: 0, h: 0 });
      return;
    }
    // otherwise start panning and clear any selected structure index
    isPanning.current = true;
    lastPos.current = canvasPos;
    setSelectedStructureIndex(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    // update preview position when moving
    const canvasPos = toCanvasPos(e);
    const worldX = offset.x + canvasPos.x / scale;
    const worldY = offset.y + canvasPos.y / scale;
    setPreviewPos({ x: worldX, y: worldY });
    // detect hover over existing structures
    const hitIndex = structures.findIndex((s) => Math.hypot(s.x - worldX, s.y - worldY) < 36);
    if (hitIndex >= 0) {
      const hit = structures[hitIndex];
      setHoveredLabel(`${hit.type}${hit.comment ? `: ${hit.comment}` : ""}`);
      // store screen pos for drawing label near structure
      setHoveredStructureIndex(hitIndex);
      setHoveredStructureScreenPos({ x: canvasPos.x, y: canvasPos.y });
    } else {
      const th = trees.find((t) => Math.hypot(t.x - worldX, t.y - worldY) < 14);
      if (th) setHoveredLabel("Arbre");
      else setHoveredLabel(null);
      setHoveredStructureIndex(null);
      setHoveredStructureScreenPos(null);
    }

    // if rectangle selecting, update rect
    if (isSelecting && selectionStart.current) {
      const sx = selectionStart.current.x;
      const sy = selectionStart.current.y;
      setSelectionRect({ x: Math.min(sx, canvasPos.x), y: Math.min(sy, canvasPos.y), w: Math.abs(canvasPos.x - sx), h: Math.abs(canvasPos.y - sy) });
      return;
    }
    if (!isPanning.current || !lastPos.current) return;
    const pos = toCanvasPos(e);
    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;
    // convert pixel delta to world delta by dividing by scale
    setOffset((o) => {
      const viewW = (canvasRef.current?.width || 1600) / scale;
      const viewH = (canvasRef.current?.height || 1200) / scale;
      const nx = o.x - dx / scale;
      const ny = o.y - dy / scale;
      return clampOffset(nx, ny, viewW, viewH);
    });
    lastPos.current = pos;
  }

  function handleMouseUp() {
    // finish selection or panning
    if (isSelecting) {
      // compute which troops are inside selection rect
      if (selectionRect) {
        const rect = selectionRect;
        // convert canvas pixel rect to world coords
        const canvas = canvasRef.current;
        if (canvas) {
          const scaleX = canvas.width / canvas.getBoundingClientRect().width;
          const scaleY = canvas.height / canvas.getBoundingClientRect().height;
          const worldRect = {
            x: offset.x + rect.x / scale,
            y: offset.y + rect.y / scale,
            w: rect.w / scale,
            h: rect.h / scale,
          };
          const selected: number[] = [];
          for (let i = 0; i < troops.length; i++) {
            const t = troops[i];
            if ((t as any).owner === "enemy") continue;
            // skip troops that overlap a structure
            const overlapping = structures.some((s) => Math.hypot(s.x - t.x, s.y - t.y) < 36);
            if (overlapping) continue;
            if (t.x >= worldRect.x && t.x <= worldRect.x + worldRect.w && t.y >= worldRect.y && t.y <= worldRect.y + worldRect.h) selected.push(t.id);
          }
          setSelectedTroopIds(selected);
          setStatus(selected.length ? `${selected.length} troupe(s) sélectionnée(s)` : "Aucune troupe sélectionnée");
        }
      }
      setIsSelecting(false);
      selectionStart.current = null;
      setSelectionRect(null);
      return;
    }
    isPanning.current = false;
    lastPos.current = null;
  }

  function handleCanvasClick(e: React.MouseEvent) {
    // compute world coordinates and canvas-relative coords
    const p = toCanvasPos(e);
    const canvas = canvasRef.current;
    const worldX = offset.x + p.x / scale;
    const worldY = offset.y + p.y / scale;

    // minimap clicks are handled by the sidebar mini-canvas

    // check if clicking on a tree (give priority to tree click)
    const treeIdx = trees.findIndex((t) => Math.hypot(t.x - worldX, t.y - worldY) < 14);
    if (treeIdx >= 0) {
      // find an idle worker
      const idleIdx = workers.findIndex((w) => w.life > 0 && !w.busy);
      if (idleIdx >= 0) {
        // assign worker
        const wid = workers[idleIdx].id;
        setWorkers((ws) => ws.map((w) => (w.id === wid ? { ...w, busy: true } : w)));
        // simulate harvest
        setTimeout(() => {
          setTrees((prev) => {
            const p = [...prev];
            if (p[treeIdx]) p.splice(treeIdx, 1);
            return p;
          });
          setResources((r) => ({ ...r, wood: r.wood + 5 }));
          setWorkers((ws) => {
            const copy = ws.map((w) => ({ ...w }));
            const idx = copy.findIndex((w) => w.id === wid);
            if (idx >= 0) {
              copy[idx].busy = false;
              copy[idx].life = Math.max(0, copy[idx].life - 1);
            }
            return copy;
          });
        }, 800);
        setStatus("Ouvrier envoyé au bois");
      } else {
        setStatus("Aucun ouvrier disponible");
      }
      return;
    }

    // if weapon target mode active, apply AoE at clicked world position
      // if weapon target mode active: schedule a launch (select target)
      if (weaponTargetMode && weaponTargetMode.kind) {
        const kind = weaponTargetMode.kind;
        const targetX = worldX;
        const targetY = worldY;
        const pendingId = Date.now() + Math.floor(Math.random() * 9999);
        const timerId = window.setTimeout(() => {
          // find a launcher structure of the right type (prefer last purchased)
          const launcherType = kind === "nuke" ? "maison_nucleaire" : "maison_missile";
          let launcherIndex = -1;
          if (lastLauncherIndex !== null) {
            const s = structures[lastLauncherIndex];
            if (s && s.type === launcherType && (s as any).owner !== "enemy" && (s.weapons?.[kind] || 0) > 0) launcherIndex = lastLauncherIndex;
          }
          if (launcherIndex === -1) {
            launcherIndex = structures.findIndex((s) => s.type === launcherType && (s as any).owner !== "enemy" && (s.weapons?.[kind] || 0) > 0);
          }
          let fromX = VIRTUAL_WIDTH / 2;
          let fromY = VIRTUAL_HEIGHT / 2;
          if (launcherIndex >= 0) {
            const s = structures[launcherIndex];
            fromX = s.x;
            fromY = s.y;
          } else {
            // fallback to any launcher (even without explicit ammo) or center
            const launcher = structures.find((s) => s.type === launcherType && (s as any).owner !== "enemy");
            if (launcher) {
              fromX = launcher.x;
              fromY = launcher.y;
            }
          }
          const now = performance.now();
          const duration = kind === "nuke" ? 3000 : 2000;
          const id = Date.now() + Math.floor(Math.random() * 999);
          // detect if the player clicked on a structure
          const toStructureIndex = structures.findIndex((s) => Math.hypot(s.x - targetX, s.y - targetY) < 36);
          // mark launcher visual fire
          if (launcherIndex >= 0) {
            setStructures((prev) => prev.map((s, i) => (i === launcherIndex ? { ...s, lastFired: now } : s)));
          }
          setProjectiles((ps) => [...ps, { id, kind, fromX, fromY, toX: targetX, toY: targetY, startTime: now, duration, fromStructureIndex: launcherIndex >= 0 ? launcherIndex : undefined, toStructureIndex: toStructureIndex >= 0 ? toStructureIndex : undefined }]);
          // remove this pending entry
          setWeaponPendings((prev) => prev.filter((p) => p.id !== pendingId));
          setStatus(kind === "nuke" ? "Bombe lancée" : "Missile lancé");
        }, 8000) as unknown as number;
        // decrement stock now that we scheduled the launch: prefer structure-local stock
        if (selectedStructureIndex !== null && structures[selectedStructureIndex]?.type === (weaponTargetMode.kind === "nuke" ? "maison_nucleaire" : "maison_missile")) {
          const idx = selectedStructureIndex;
          setStructures((prev) => prev.map((s, i) => (i === idx ? { ...s, weapons: { ...(s.weapons || {}), [kind]: Math.max(0, (s.weapons?.[kind] || 0) - 1) } } : s)));
        } else {
          setWeaponsStock((w) => ({ ...w, [kind]: Math.max(0, (w as any)[kind] - 1) }));
        }
        // add pending entry
        setWeaponPendings((prev) => [...prev, { id: pendingId, kind, target: { x: targetX, y: targetY }, timerId }]);
        setWeaponTargetMode(null); // clear targeting after scheduling
        setStatus("Tir programmé: lancement dans 8s");
        return;
      }

    // check if clicking on existing structure
    const idx = structures.findIndex((s) => Math.hypot(s.x - worldX, s.y - worldY) < 40);
    if (idx >= 0) {
      // if troops selected, order them to attack this structure (by id)
      if (selectedTroopIds && selectedTroopIds.length > 0) {
        setTroops((ts) => {
          const copy = ts.map((t) => ({ ...t }));
          for (const sid of selectedTroopIds) {
            const tidx = copy.findIndex((c) => c.id === sid);
            if (tidx >= 0) copy[tidx].target = { structureIndex: idx } as any;
          }
          return copy;
        });
        setStatus("Troupes ordonnées d'attaquer");
        return;
      }
      // otherwise mark structure as selected so sidebar shows delete control
      setSelectedStructureIndex(idx);
      // show its name next to cursor
      const s = structures[idx];
      const name = s.type === "maison_centrale" ? "Maison centrale" : s.type.replace(/_/g, " ");
      // set clicked label and position (p is canvas pixel coords)
      setClickedLabel(name);
      setClickedCursorPos({ x: p.x, y: p.y });
      if (clickLabelTimeout.current) window.clearTimeout(clickLabelTimeout.current);
      clickLabelTimeout.current = window.setTimeout(() => {
        setClickedLabel(null);
        setClickedCursorPos(null);
        clickLabelTimeout.current = null;
      }, 4000);
      return;
    }

    // if clicking on a troop -> either order selected troops to target that troop, or select it
    const troopIdx = troops.findIndex((t) => {
      if ((t as any).owner === "enemy") return false;
      // ignore troops overlapping structures
      if (structures.some((s) => Math.hypot(s.x - t.x, s.y - t.y) < 36)) return false;
      return Math.hypot(t.x - worldX, t.y - worldY) < 12;
    });
    if (troopIdx >= 0) {
      const clickedTid = troops[troopIdx].id;
      // if we have other selected troops, treat this as an order: attack/heal that troop
      if (selectedTroopIds && selectedTroopIds.length > 0 && !(selectedTroopIds.length === 1 && selectedTroopIds[0] === clickedTid)) {
        setTroops((ts) => {
          const copy = ts.map((t) => ({ ...t }));
          for (const sid of selectedTroopIds) {
            const idx = copy.findIndex((c) => c.id === sid);
            if (idx >= 0) copy[idx].target = { troopId: clickedTid } as any;
          }
          return copy;
        });
        setStatus("Troupes ordonnées vers cible");
        return;
      }
      // otherwise toggle selection or select single
      const tid = troops[troopIdx].id;
      if (e.shiftKey || multiSelectMode) {
        setSelectedTroopIds((cur) => {
          if (cur.includes(tid)) return cur.filter((i) => i !== tid);
          return [...cur, tid];
        });
      } else {
        setSelectedTroopIds([tid]);
      }
      setStatus("Troupe sélectionnée");
      return;
    }

    // if placing a new structure: place immediately at click (check cost)
    if (selectedStructure) {
      const place = { x: Math.round(worldX), y: Math.round(worldY), type: selectedStructure };
      // prevent placing more than one maison_centrale
      if (place.type === "maison_centrale" && structures.some((s) => s.type === "maison_centrale")) {
        setStatus("Une maison centrale existe déjà");
        // cancel placement mode and preview so it doesn't follow cursor
        setSelectedStructure(null);
        setRightSelectedBuilding(null);
        setPreviewPos(null);
        return;
      }
      const price = structurePrices[place.type];
      if (price) {
        if (resources.gold < (price.gold || 0) || resources.iron < (price.iron || 0) || resources.wood < (price.wood || 0)) {
          setStatus("Pas assez de minerais pour construire");
          return;
        }
        setResources((r) => ({ ...r, gold: r.gold - (price.gold || 0), iron: r.iron - (price.iron || 0), wood: r.wood - (price.wood || 0) }));
      }
      setStructures((s) => {
        const idx = s.length;
        const base = { type: place.type, x: place.x, y: place.y, hp: 100, owner: "player" } as any;
        if (place.type === "maison_missile" || place.type === "maison_nucleaire") base.weapons = {};
        const next = [...s, base];
        // select the newly placed structure (deferred to next tick)
        setTimeout(() => setSelectedStructureIndex(idx), 0);
        return next;
      });
      setStatus(`${place.type} placée`);
      // show a click label near cursor
      setClickedLabel(place.type.replace(/_/g, " "));
      setClickedCursorPos({ x: p.x, y: p.y });
      if (clickLabelTimeout.current) window.clearTimeout(clickLabelTimeout.current);
      clickLabelTimeout.current = window.setTimeout(() => {
        setClickedLabel(null);
        setClickedCursorPos(null);
        clickLabelTimeout.current = null;
      }, 3000);
      // deselect placement mode and clear preview
      setSelectedStructure(null);
      setRightSelectedBuilding(null);
      setPreviewPos(null);
      setHoveredLabel(null);
      return;
    } else {
      // if one or more troops are selected
      if (selectedTroopIds && selectedTroopIds.length > 0) {
        // if a single missile_truck is selected and user holds Shift while clicking -> fire missile
        const sel = troops.filter((t) => selectedTroopIds.includes(t.id) && (t as any).owner !== "enemy");
        if (sel.length === 1 && sel[0].type === "missile_truck" && e.shiftKey) {
          const truck = sel[0];
          const now = performance.now();
          const idp = Date.now() + Math.floor(Math.random() * 999);
          const duration = 2000;
          setProjectiles((ps) => [...ps, { id: idp, kind: "missile", fromX: truck.x, fromY: truck.y, toX: worldX, toY: worldY, startTime: now, duration }]);
          setTroops((ts) => ts.map((t) => (t.id === truck.id ? { ...t, lastFired: now } : t)));
          setStatus("Missile lancé depuis camion");
          return;
        }
        // otherwise order movement for selected troops
        setTroops((ts) => {
          const copy = ts.map((t) => ({ ...t }));
          for (const sid of selectedTroopIds) {
            const idx = copy.findIndex((c) => c.id === sid);
            if (idx >= 0) copy[idx].target = { x: Math.round(worldX), y: Math.round(worldY) } as any;
          }
          return copy;
        });
        setStatus("Troupes en déplacement");
        return;
      }
      // clicked empty space: clear any selected structure index and clicked label
      setSelectedStructureIndex(null);
      setClickedLabel(null);
      setClickedCursorPos(null);
      if (clickLabelTimeout.current) {
        window.clearTimeout(clickLabelTimeout.current);
        clickLabelTimeout.current = null;
      }
    }
  }

  function handleDeleteStructure(index: number) {
    const s = structures[index];
    if (!s) return;
    if ((s as any).owner === "enemy") {
      setStatus("Impossible de supprimer un bâtiment ennemi");
      return;
    }
    setStructures((prev) => prev.filter((_, i) => i !== index));
    setSelectedStructureIndex(null);
    setStatus("Maison supprimée");
  }

  function hireWorker() {
    setWorkers((ws) => {
      const nextId = ws.length ? Math.max(...ws.map((w) => w.id)) + 1 : 1;
      return [...ws, { id: nextId, life: 10, busy: false }];
    });
    setStatus("Ouvrier embauché");
  }

  // troop definitions/stats
  const troopStats: Record<string, { speed: number; damage: number; hp: number; size: number; heal?: number }> = {
    soldat: { speed: 5, damage: 8, hp: 120, size: 6 },
    sniper: { speed: 4, damage: 18, hp: 80, size: 6 },
    tank: { speed: 2.5, damage: 20, hp: 220, size: 9 },
    drone: { speed: 4, damage: 0, hp: 90, size: 6, heal: 50 },
    // missile truck: controllable vehicle that can fire missiles (shift+click to fire)
    missile_truck: { speed: 3.0, damage: 35, hp: 200, size: 10 },
  };

  // troop movement and attack loop (simple)
  useEffect(() => {
    const id = setInterval(() => {
      // move troops towards targets
      setTroops((prev) => {
        const next = prev.map((t) => ({ ...t }));
        for (const tr of next) {
          // auto-healer behaviour for drones: seek injured friend
          if (tr.type === "drone") {
            // try to find nearest injured friendly troop
            const injured = next.find((z) => z.owner !== "enemy" && z.hp < (troopStats[z.type]?.hp ?? 100) && z.id !== tr.id);
            if (injured) {
              tr.target = { x: injured.x, y: injured.y } as any;
            }
          }
          if (tr.target && "x" in tr.target) {
            const dx = tr.target.x - tr.x;
            const dy = tr.target.y - tr.y;
            const dist = Math.hypot(dx, dy);
            const speed = troopStats[tr.type]?.speed ?? 4;
            if (dist > 4) {
              const step = Math.min(speed, dist);
              const nextX = tr.x + (dx / dist) * step;
              const nextY = tr.y + (dy / dist) * step;
              // prevent missile truck from entering structures
              if (tr.type === "missile_truck") {
                const coll = structures.find((ss) => Math.hypot(ss.x - nextX, ss.y - nextY) < 36);
                if (!coll) {
                  tr.x = nextX;
                  tr.y = nextY;
                }
              } else {
                tr.x = nextX;
                tr.y = nextY;
              }
            } else {
              // reached
              // if drone reached an injured unit, heal
              if (tr.type === "drone") {
                // heal troops in range
                setTroops((pts) => pts.map((tt) => {
                  if (Math.hypot(tt.x - tr.x, tt.y - tr.y) <= 24 && tt.owner !== "enemy") {
                    const mh = troopStats[tt.type]?.hp ?? 100;
                    return { ...tt, hp: Math.min(mh, tt.hp + (troopStats[tr.type]?.heal ?? 6)) };
                  }
                  return tt;
                }));
                // heal structures in range
                setStructures((ps) => ps.map((s) => {
                  if (Math.hypot(s.x - tr.x, s.y - tr.y) <= 30) {
                    return { ...s, hp: Math.min(100, (s.hp ?? 100) + (troopStats[tr.type]?.heal ?? 6)) };
                  }
                  return s;
                }));
              }
              delete tr.target;
            }
          } else if (tr.target && "structureIndex" in tr.target) {
            const si = tr.target.structureIndex;
            const s = structures[si];
            if (!s) {
              delete tr.target;
              continue;
            }
            const dx = s.x - tr.x;
            const dy = s.y - tr.y;
            const dist = Math.hypot(dx, dy);
            const speed = troopStats[tr.type]?.speed ?? 4;
            if (dist > 40) {
              const step = Math.min(speed, dist);
              const nextX = tr.x + (dx / dist) * step;
              const nextY = tr.y + (dy / dist) * step;
              if (tr.type === "missile_truck") {
                const coll = structures.find((ss) => Math.hypot(ss.x - nextX, ss.y - nextY) < 36);
                if (!coll) {
                  tr.x = nextX;
                  tr.y = nextY;
                }
              } else {
                tr.x = nextX;
                tr.y = nextY;
              }
            } else {
              // attack structure: use troop damage stat (drones heal instead)
              if (tr.type === "drone") {
                // heal structures in range
                setStructures((ps) => ps.map((s, idx) => {
                  if (idx === si) {
                    return { ...s, hp: Math.min(100, (s.hp ?? 100) + (troopStats[tr.type]?.heal ?? 6)) };
                  }
                  return s;
                }));
              } else {
                const dmg = troopStats[tr.type]?.damage ?? 6;
                // spawn a small bullet visual
                const now = performance.now();
                const bulletId = Date.now() + Math.floor(Math.random() * 999);
                setProjectiles((ps) => [...ps, { id: bulletId, kind: "bullet", fromX: tr.x, fromY: tr.y, toX: s.x, toY: s.y, startTime: now, duration: 240 }]);
                setStructures((prevS) => {
                  const out = prevS.map((z) => ({ ...z }));
                  if (out[si]) {
                    out[si].hp = Math.max(0, (out[si].hp ?? 100) - dmg);
                  }
                  return out.filter((s) => (s.hp ?? 100) > 0);
                });
              }
            }
          } else if (tr.target && "troopId" in tr.target) {
            // target is a troop id: chase and attack/heal
            const targetId = (tr.target as any).troopId as number;
            const targetTroop = next.find((z) => z.id === targetId);
            if (!targetTroop) {
              delete tr.target;
              continue;
            }
            const dx2 = targetTroop.x - tr.x;
            const dy2 = targetTroop.y - tr.y;
            const dist2 = Math.hypot(dx2, dy2);
            const speed2 = troopStats[tr.type]?.speed ?? 4;
            if (dist2 > 20) {
              const step = Math.min(speed2, dist2);
              const nextX = tr.x + (dx2 / dist2) * step;
              const nextY = tr.y + (dy2 / dist2) * step;
              if (tr.type === "missile_truck") {
                const coll = structures.find((ss) => Math.hypot(ss.x - nextX, ss.y - nextY) < 36);
                if (!coll) {
                  tr.x = nextX;
                  tr.y = nextY;
                }
              } else {
                tr.x = nextX;
                tr.y = nextY;
              }
            } else {
              // in range: drone heals, others damage
              if (tr.type === "drone") {
                setTroops((pts) => pts.map((tt) => (tt.id === targetId ? { ...tt, hp: Math.min(troopStats[tt.type]?.hp ?? 100, tt.hp + (troopStats[tr.type]?.heal ?? 6)) } : tt)));
              } else {
                const dmg2 = troopStats[tr.type]?.damage ?? 6;
                // visual bullet
                const now = performance.now();
                const bid = Date.now() + Math.floor(Math.random() * 999);
                setProjectiles((ps) => [...ps, { id: bid, kind: "bullet", fromX: tr.x, fromY: tr.y, toX: targetTroop.x, toY: targetTroop.y, startTime: now, duration: 200 }]);
                setTroops((pts) => pts.map((tt) => (tt.id === targetId ? { ...tt, hp: Math.max(0, tt.hp - dmg2) } : tt)).filter((t) => t.hp > 0));
              }
            }
          }
        }
        return next;
      });
    }, 300);
    return () => clearInterval(id);
  }, [structures]);

  function confirmPlace(withComment = true) {
    if (!pendingPlace) return;
    const comment = withComment ? commentText.trim() : undefined;
    // check price and deduct resources if applicable
    const price = structurePrices[pendingPlace.type];
    if (price) {
      if (resources.gold < (price.gold || 0) || resources.iron < (price.iron || 0) || resources.wood < (price.wood || 0)) {
        setStatus("Pas assez de minerais pour construire");
        setPendingPlace(null);
        setShowCommentPrompt(false);
        setSelectedStructure(null);
        return;
      }
      setResources((r) => ({ ...r, gold: r.gold - (price.gold || 0), iron: r.iron - (price.iron || 0), wood: r.wood - (price.wood || 0) }));
    }
    setStructures((s) => {
      const base: any = { type: pendingPlace.type, x: pendingPlace.x, y: pendingPlace.y, comment, hp: 100, owner: "player" };
      if (pendingPlace.type === "maison_missile" || pendingPlace.type === "maison_nucleaire") base.weapons = {};
      return [...s, base];
    });
    setStatus(`${pendingPlace.type} placée`);
    setPendingPlace(null);
    setShowCommentPrompt(false);
    setCommentText("");
    // deselect after placing so cursor no longer shows preview
    setSelectedStructure(null);
  }

  // purchase troop from a maison_troupe: must have resources
  function purchaseTroop(kind: "soldat" | "sniper" | "tank" | "drone" | "missile_truck") {
    // find a maison_troupe to spawn from (selectedStructureIndex or nearest)
    const spIndex = selectedStructureIndex !== null && structures[selectedStructureIndex]?.type === "maison_troupe" ? selectedStructureIndex : structures.findIndex((s) => s.type === "maison_troupe");
    if (spIndex < 0) return setStatus("Aucune maison de troupe disponible");
    const spawn = structures[spIndex];
    // costs
    const costs: Record<string, { gold: number; iron: number }> = {
      soldat: { gold: 6, iron: 2 },
      sniper: { gold: 10, iron: 2 },
      tank: { gold: 20, iron: 8 },
      drone: { gold: 8, iron: 3 },
      missile_truck: { gold: 30, iron: 10 },
    };
    const cost = costs[kind];
    if (resources.gold < cost.gold || resources.iron < cost.iron) return setStatus("Pas assez de minerais");
    // deduct
    setResources((r) => ({ ...r, gold: r.gold - cost.gold, iron: r.iron - cost.iron }));
    // spawn troop
    const id = nextIds.current.troop++;
    const stats = troopStats[kind];
    // spawn slightly offset; give a short delay before deploy so unit 'forms' then moves a few meters
    // try to spawn the troop at a free nearby location so it doesn't overlap a structure
    const tryRadius = [20, 34, 48, 64, 80, 100];
    let spawnX = spawn.x + 20 + Math.floor(Math.random() * 12 - 6);
    let spawnY = spawn.y + 10 + Math.floor(Math.random() * 12 - 6);
    const collidesWithStructure = (x: number, y: number) => structures.some((s) => Math.hypot(s.x - x, s.y - y) < 36);
    if (collidesWithStructure(spawnX, spawnY)) {
      let found = false;
      for (const r of tryRadius) {
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const nx = Math.round(spawn.x + Math.cos(ang) * r);
          const ny = Math.round(spawn.y + Math.sin(ang) * r + 8);
          if (!collidesWithStructure(nx, ny)) {
            spawnX = nx; spawnY = ny; found = true; break;
          }
        }
        if (found) break;
      }
      // if still colliding, push it further away
      if (collidesWithStructure(spawnX, spawnY)) {
        spawnX = spawn.x + 120;
        spawnY = spawn.y + 40;
      }
    }
    const t = { id, type: kind, x: spawnX, y: spawnY, hp: stats?.hp ?? 100, owner: "player" } as any;
    setTroops((ts) => [...ts, t]);
    setStatus(`${kind} recruté`);
    // after short formation delay, give a nearby deploy target so troops leave the spawn
    setTimeout(() => {
      const deployX = spawnX + (Math.random() * 80 - 40);
      const deployY = spawnY + (Math.random() * 80 - 40);
      // missile truck should be controllable: still give it an initial deploy target
      setTroops((ts) => ts.map((u) => (u.id === id ? { ...u, target: { x: Math.round(deployX), y: Math.round(deployY) } } : u)));
    }, 700 + Math.floor(Math.random() * 600));
  }

  // buy missile/nuke: activates weapon target mode
  function purchaseWeapon(kind: "missile" | "nuke") {
    const costs = { missile: { gold: 20, iron: 8 }, nuke: { gold: 120, iron: 60 } };
    const c = costs[kind];
    if (resources.gold < c.gold || resources.iron < c.iron) return setStatus("Pas assez de minerais");
    setResources((r) => ({ ...r, gold: r.gold - c.gold, iron: r.iron - c.iron }));
    // if a launcher is selected (maison_missile or maison_nucleaire), attach ammo to that structure
    const launcherType = kind === "nuke" ? "maison_nucleaire" : "maison_missile";
    if (selectedStructureIndex !== null && structures[selectedStructureIndex]?.type === launcherType) {
      const idx = selectedStructureIndex;
      setStructures((prev) => prev.map((s, i) => (i === idx ? { ...s, weapons: { ...(s.weapons || {}), [kind]: (s.weapons?.[kind] || 0) + 1 } } : s)));
      setLastLauncherIndex(idx);
      setStatus(kind === "nuke" ? "Bombe stockée dans la maison sélectionnée" : "Missile stocké dans la maison sélectionnée");
      return;
    }
    // otherwise add to global stock
    setWeaponsStock((w) => ({ ...w, [kind]: (w as any)[kind] + 1 }));
    setStatus(kind === "nuke" ? "Bombe stockée" : "Missile stocké");
  }

  useEffect(() => {
    drawMap();
  }, [offset, trees, structures, previewPos, hoveredLabel, selectedStructure, scale, projectiles, explosions, troops, weaponPendings]);

  // keyboard control for single selected missile_truck (WASD / arrows)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedTroopIds || selectedTroopIds.length !== 1) return;
      const selId = selectedTroopIds[0];
      const st = troops.find((t) => t.id === selId);
      if (!st || st.type !== "missile_truck") return;
      const step = 6;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dy -= step;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dy += step;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dx -= step;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dx += step;
      if (dx !== 0 || dy !== 0) {
        setTroops((ts) => ts.map((t) => (t.id === selId ? { ...t, x: t.x + dx, y: t.y + dy } : t)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTroopIds, troops]);

  // Draw projectiles/explosions and update via RAF
  useEffect(() => {
    let raf = 0;
    function step() {
      const now = performance.now();
      // update projectiles: handle mid-air collisions, early impacts and final impacts
      setProjectiles((prev) => {
        const out: typeof prev = [];
        const positions = prev.map((p) => {
          const t = (now - p.startTime) / p.duration;
          const clamped = Math.min(1, Math.max(0, t));
          const x = p.fromX + (p.toX - p.fromX) * clamped;
          const y = p.fromY + (p.toY - p.fromY) * clamped;
          return { p, t: clamped, x, y };
        });
        const removed = new Set<number>();

        // projectile-projectile collisions
        for (let i = 0; i < positions.length; i++) {
          const a = positions[i];
          if (removed.has(a.p.id)) continue;
          for (let j = i + 1; j < positions.length; j++) {
            const b = positions[j];
            if (removed.has(b.p.id)) continue;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy);
            const thresh = 16; // collision threshold
            if (d < thresh) {
              // midair explosion
              setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: 48, start: now }]);
              // apply damage near collision point
              const cx = (a.x + b.x) / 2;
              const cy = (a.y + b.y) / 2;
              setStructures((prevS) => {
                const outS = prevS.map((s) => ({ ...s }));
                for (let k = outS.length - 1; k >= 0; k--) {
                  const s = outS[k];
                  const dd = Math.hypot(s.x - cx, s.y - cy);
                  if (dd <= 48) outS[k].hp = Math.max(0, (outS[k].hp ?? 100) - missileDamage);
                }
                return outS.filter((s) => (s.hp ?? 100) > 0);
              });
              setTroops((prevT) => prevT.map((t2) => {
                const dd = Math.hypot(t2.x - cx, t2.y - cy);
                if (dd <= 48) return { ...t2, hp: Math.max(0, t2.hp - missileDamage) };
                return t2;
              }).filter((t2) => t2.hp > 0));
              removed.add(a.p.id);
              removed.add(b.p.id);
            }
          }
        }

        // check per-projectile interactions
        for (const pos of positions) {
          const p = pos.p;
          if (removed.has(p.id)) continue;
          // final impact
          if (pos.t >= 1) {
            if (p.kind === "missile" || p.kind === "nuke") {
              const radius = p.kind === "nuke" ? 180 : 90;
              setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: p.toX, y: p.toY, radius, start: now }]);
              setStructures((prevS) => {
                const outS = prevS.map((s) => ({ ...s }));
                for (let i = outS.length - 1; i >= 0; i--) {
                  const s = outS[i];
                  const d = Math.hypot(s.x - p.toX, s.y - p.toY);
                  if (d <= radius) {
                    outS[i].hp = Math.max(0, (outS[i].hp ?? 100) - (p.kind === "nuke" ? nukeDamage : missileDamage));
                  }
                }
                return outS.filter((s) => (s.hp ?? 100) > 0);
              });
              setTroops((prevT) => prevT.map((t2) => {
                const d2 = Math.hypot(t2.x - p.toX, t2.y - p.toY);
                if (d2 <= (p.kind === "nuke" ? 180 : 90)) return { ...t2, hp: Math.max(0, t2.hp - (p.kind === "nuke" ? nukeDamage : missileDamage)) };
                return t2;
              }).filter((t2) => t2.hp > 0));
            } else {
              // bullet impact: small damage to nearby troops/structures
              const ix = p.toX;
              const iy = p.toY;
              setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: ix, y: iy, radius: 12, start: now }]);
              setTroops((prevT) => prevT.map((t2) => {
                const d2 = Math.hypot(t2.x - ix, t2.y - iy);
                if (d2 <= 16) return { ...t2, hp: Math.max(0, t2.hp - bulletDamage) };
                return t2;
              }).filter((t2) => t2.hp > 0));
              setStructures((prevS) => prevS.map((s) => ({ ...s })).map((s) => s));
              // small structure damage near impact
              setStructures((prevS) => prevS.map((s) => {
                const d = Math.hypot(s.x - ix, s.y - iy);
                if (d <= 16) return { ...s, hp: Math.max(0, (s.hp ?? 100) - Math.round(bulletDamage / 2)) };
                return s;
              }).filter((s) => (s.hp ?? 100) > 0));
            }
            removed.add(p.id);
            continue;
          }

          // in-flight collision with structures
          let impacted = false;
          for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            const dd = Math.hypot(s.x - pos.x, s.y - pos.y);
            if (dd <= 28) {
              // impact
              const ix = pos.x;
              const iy = pos.y;
              const radius = p.kind === "nuke" ? 180 : p.kind === "missile" ? 90 : 8;
              setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: ix, y: iy, radius, start: now }]);
              setStructures((prevS) => {
                const outS = prevS.map((zz) => ({ ...zz }));
                for (let k = outS.length - 1; k >= 0; k--) {
                  const ss = outS[k];
                  const ddd = Math.hypot(ss.x - ix, ss.y - iy);
                  if (ddd <= radius) outS[k].hp = Math.max(0, (outS[k].hp ?? 100) - (p.kind === "nuke" ? nukeDamage : missileDamage));
                }
                return outS.filter((s) => (s.hp ?? 100) > 0);
              });
              setTroops((prevT) => prevT.map((t2) => {
                const ddd = Math.hypot(t2.x - ix, t2.y - iy);
                if (ddd <= radius) return { ...t2, hp: Math.max(0, t2.hp - (p.kind === "nuke" ? nukeDamage : missileDamage)) };
                return t2;
              }).filter((t2) => t2.hp > 0));
              removed.add(p.id);
              impacted = true;
              break;
            }
          }
          if (impacted) continue;

          // in-flight collision with troops
          for (let i = 0; i < troops.length; i++) {
            const ttroop = troops[i];
            const dd = Math.hypot(ttroop.x - pos.x, ttroop.y - pos.y);
            if (dd <= 12) {
              // direct hit
              setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: pos.x, y: pos.y, radius: 24, start: now }]);
              setTroops((prevT) => prevT.map((tt) => (tt.id === ttroop.id ? { ...tt, hp: Math.max(0, tt.hp - (p.kind === "nuke" ? nukeDamage : missileDamage)) } : tt)).filter((t2) => t2.hp > 0));
              removed.add(p.id);
              impacted = true;
              break;
            }
          }
          if (impacted) continue;

          // otherwise keep flying
          out.push(p);
        }

        return out.filter((p) => !removed.has(p.id));
      });

      // cull old explosions
      setExplosions((prev) => prev.filter((ex) => now - ex.start < 1200));
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [projectiles]);

  // auto-defense system: detect incoming missiles/nukes and fire to intercept
  useEffect(() => {
    const t = setInterval(() => {
      const defs = structures.map((s, idx) => ({ s, idx })).filter((x) => x.s.type === "maison_defense");
      if (defs.length === 0) return;
      const now = performance.now();
      // operate on current projectiles snapshot
      setProjectiles((prev) => {
        const added: typeof prev = [];
        const removedIds = new Set<number>();
        for (const def of defs) {
          const sx = def.s.x;
          const sy = def.s.y;
          const cooldown = 700; // ms
          const range = MAISON_DEFENSE_RANGE;
          if ((def.s as any).lastFired && now - (def.s as any).lastFired < cooldown) continue;
          // find incoming threat near turret
          const threat = prev.find((p) => (p.kind === "missile" || p.kind === "nuke") && Math.hypot(p.toX - sx, p.toY - sy) <= range);
          // also detect nearby enemy troops to engage
          const nearbyTroop = troops.find((tr) => (tr as any).owner === "enemy" && Math.hypot(tr.x - sx, tr.y - sy) <= range);
          if (threat) {
            // mark turret fired (update structures)
            setStructures((ps) => ps.map((s, i) => (i === def.idx ? { ...s, lastFired: now } : s)));
            // spawn several visual bullets toward threat
            for (let i = 0; i < 4; i++) {
              const idp = Date.now() + Math.floor(Math.random() * 9999) + i;
              added.push({ id: idp, kind: "bullet", fromX: sx, fromY: sy, toX: threat.toX + (i - 1.5) * 6, toY: threat.toY + (i - 1.5) * 6, startTime: now, duration: 300 + i * 40 });
            }
            // neutralize incoming threat immediately (create small explosion)
            removedIds.add(threat.id);
            setExplosions((ex) => [...ex, { id: Date.now() + Math.random(), x: threat.toX, y: threat.toY, radius: 28, start: now }]);
          } else if (nearbyTroop) {
            // engage enemy troop with bullets
            setStructures((ps) => ps.map((s, i) => (i === def.idx ? { ...s, lastFired: now } : s)));
            for (let i = 0; i < 3; i++) {
              const idp = Date.now() + Math.floor(Math.random() * 9999) + i;
              added.push({ id: idp, kind: "bullet", fromX: sx, fromY: sy, toX: nearbyTroop.x + (i - 1) * 4, toY: nearbyTroop.y + (i - 1) * 4, startTime: now, duration: 220 + i * 40 });
            }
          }
        }
        if (added.length === 0 && removedIds.size === 0) return prev;
        return prev.filter((p) => !removedIds.has(p.id)).concat(added);
      });
    }, 220);
    return () => clearInterval(t);
  }, [projectiles, structures, troops]);

  // ensure structures loaded from saved game have hp defaults
  useEffect(() => {
    setStructures((s) => s.map((it) => ({ hp: 100, ...it })));
  }, []);

  // production tick for central resources (gold / iron / petrol)
  useEffect(() => {
    const t = setInterval(() => {
      // production only active when a central house exists
      const hasCentral = structures.some((s) => s.type === "maison_centrale");
      if (!hasCentral) return;
      // base production provided by centrale
      const base = { gold: 1, iron: 0.5, petrol: 0.2, wood: 0 };
      // each mine increases per-second production
      const perMine = { gold: 0.7, iron: 0.6, petrol: 0.3, wood: 0.5 };
      const mineCount = structures.filter((s) => s.type === "maison_mine").length;
      setResources((r) => ({
        wood: +(r.wood + perMine.wood * mineCount).toFixed(2),
        gold: +(r.gold + base.gold + perMine.gold * mineCount).toFixed(2),
        iron: +(r.iron + base.iron + perMine.iron * mineCount).toFixed(2),
        petrol: +(r.petrol + base.petrol + perMine.petrol * mineCount).toFixed(2),
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [structures]);

  // maison_mine production: each mine adds minerals per tick
  useEffect(() => {
    const t = setInterval(() => {
      const mineCount = structures.filter((s) => s.type === "maison_mine").length;
      // only produce when centrale exists
      const hasCentral = structures.some((s) => s.type === "maison_centrale");
      if (!hasCentral) return;
      setResources((r) => ({
        wood: +(r.wood + 0.5 * mineCount).toFixed(2),
        gold: +(r.gold + 0.7 * mineCount + 1).toFixed(2),
        iron: +(r.iron + 0.6 * mineCount + 0.5).toFixed(2),
        petrol: +(r.petrol + 0.3 * mineCount + 0.2).toFixed(2),
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [structures]);

  // regenerate trees when they become scarce
  useEffect(() => {
    const regen = setInterval(() => {
      setTrees((prev) => {
        const min = 40;
        if (prev.length >= min) return prev;
        const add = min - prev.length;
        const rnd = mulberry32(Date.now());
        const extra: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < add; i++) {
          extra.push({ x: Math.floor(rnd() * VIRTUAL_WIDTH), y: Math.floor(rnd() * VIRTUAL_HEIGHT) });
        }
        return [...prev, ...extra];
      });
    }, 5000);
    return () => clearInterval(regen);
  }, []);

  // enemy resource tick and simple evaluation log
  useEffect(() => {
    const t = setInterval(() => {
      // base income for enemy (small)
      const enemyMineCount = structures.filter((s) => (s as any).owner === "enemy" && s.type === "maison_mine").length;
      setEnemyResources((r) => ({
        wood: +(r.wood + 0.3 + 0.3 * enemyMineCount).toFixed(2),
        gold: +(r.gold + 0.6 + 0.5 * enemyMineCount).toFixed(2),
        iron: +(r.iron + 0.4 + 0.4 * enemyMineCount).toFixed(2),
        petrol: +(r.petrol + 0.1).toFixed(2),
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [structures]);

  // enemy builds occasionally using its own resources (limited)
  useEffect(() => {
    const ai = setInterval(() => {
      const base = structures.find((s) => s.type === "maison_enemy" && (s as any).owner === "enemy");
      if (!base) return;
      const enemyOwned = structures.filter((s) => (s as any).owner === "enemy");
      // limit total enemy structures to 4
      if (enemyOwned.length >= 4) return;
      // choose a candidate building
      const choices = ["maison_mine", "maison_troupe", "maison_missile"];
      const choice = choices[Math.floor(Math.random() * choices.length)];
      const cost = enemyStructureCosts[choice] || { gold: 0, iron: 0 };
      if (enemyResources.gold >= cost.gold && enemyResources.iron >= cost.iron) {
        // build near base
        const bx = base.x + (Math.random() * 160 - 80);
        const by = base.y + (Math.random() * 160 - 80);
          setStructures((s) => [...s, { type: choice, x: Math.round(bx), y: Math.round(by), hp: 100, owner: "enemy", weapons: {} } as any]);
        setEnemyResources((r) => ({ ...r, gold: r.gold - cost.gold, iron: r.iron - cost.iron }));
        pushLog(`Bot: construit ${choice}`);
      }
    }, 20000 + Math.floor(Math.random() * 20000));
    return () => clearInterval(ai);
  }, [structures, enemyResources]);

  // periodic evaluation: who is stronger in ressources / combat
  useEffect(() => {
    const evalT = setInterval(() => {
      const playerResSum = resources.gold + resources.iron + resources.wood + resources.petrol;
      const enemyResSum = enemyResources.gold + enemyResources.iron + enemyResources.wood + enemyResources.petrol;
      // combat power roughly: troops hp sum + structures*10
      const playerPower = troops.filter((t) => (t as any).owner !== "enemy").reduce((s, t) => s + (t.hp || 0) + (troopStats[t.type]?.damage || 0), 0) + structures.filter((s) => (s as any).owner !== "enemy").length * 10;
      const enemyPower = troops.filter((t) => (t as any).owner === "enemy").reduce((s, t) => s + (t.hp || 0) + (troopStats[t.type]?.damage || 0), 0) + structures.filter((s) => (s as any).owner === "enemy").length * 10;
      if (enemyResSum > playerResSum * 1.2) pushLog("Bot: plus riche en minerais");
      if (enemyPower > playerPower * 1.2) pushLog("Bot: plus puissant en combat");
    }, 10000);
    return () => clearInterval(evalT);
  }, [resources, enemyResources, troops, structures]);

  // enemy is passive by default (no spawning AI)

  // Persist resources/workers to saved game when saving
  async function handleSaveGame(name: string) {
    const raw = localStorage.getItem("user");
    if (!raw) return setStatus("Connectez-vous pour sauvegarder");
    const user = JSON.parse(raw);
    const gameData: any = {
      seed,
      structures,
      resources,
      workers,
    };
    gameData.weaponsStock = weaponsStock;
    try {
      const res = await fetch("/api/game/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, owner: user.email, data: gameData }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("Partie sauvegardée");
    } catch (e: any) {
      setStatus("Erreur de sauvegarde: " + e.message);
    }
  }

  // automatic workers: assign idle workers to nearest tree every 2s
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkers((ws) => {
        let treesCopy = trees;
        const newWorkers = ws.map((w) => ({ ...w }));
        for (let i = 0; i < newWorkers.length; i++) {
          const w = newWorkers[i];
          if (w.life > 0 && !w.busy && treesCopy.length > 0) {
            // pick first tree (simple)
            const treeIndex = 0;
            w.busy = true;
            // simulate travel/harvest
            setTimeout(() => {
              setTrees((prev) => {
                const p = [...prev];
                if (p[treeIndex]) p.splice(treeIndex, 1);
                return p;
              });
              setResources((r) => ({ ...r, wood: r.wood + 5 }));
              setWorkers((ws2) => {
                const copy = ws2.map((z) => ({ ...z }));
                const idx = copy.findIndex((z) => z.id === w.id);
                if (idx >= 0) {
                  copy[idx].life = Math.max(0, copy[idx].life - 1);
                  copy[idx].busy = false;
                }
                return copy;
              });
            }, 800);
          }
        }
        return newWorkers;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [trees]);

  // periodic capture-line evaluation
  useEffect(() => {
    const t = setInterval(() => {
      const segW = VIRTUAL_WIDTH / NUM_SEGMENTS;
      setCaptureSegments((prev) => {
        const next = [...prev];
        for (let i = 0; i < NUM_SEGMENTS; i++) {
          const x0 = i * segW;
          const x1 = x0 + segW;
          const playerCount = troops.filter((tr) => (tr as any).owner !== "enemy" && tr.x >= x0 && tr.x < x1).length + structures.filter((s) => (s as any).owner !== "enemy" && s.x >= x0 && s.x < x1).length;
          const enemyCount = troops.filter((tr) => (tr as any).owner === "enemy" && tr.x >= x0 && tr.x < x1).length + structures.filter((s) => (s as any).owner === "enemy" && s.x >= x0 && s.x < x1).length;
          if (playerCount > enemyCount * 1.2 && playerCount > 0) next[i] = "player";
          else if (enemyCount > playerCount * 1.2 && enemyCount > 0) next[i] = "enemy";
          else next[i] = null;
        }
        const allPlayer = next.every((v) => v === "player");
        const allEnemy = next.every((v) => v === "enemy");
        if (allPlayer) setGameWinner("player");
        else if (allEnemy) setGameWinner("enemy");
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [troops, structures]);

  // control percentages (player vs enemy) computed from owned troops+structures
  useEffect(() => {
    const compute = () => {
      const playerCount = troops.filter((t) => (t as any).owner !== "enemy").length + structures.filter((s) => (s as any).owner !== "enemy").length;
      const enemyCount = troops.filter((t) => (t as any).owner === "enemy").length + structures.filter((s) => (s as any).owner === "enemy").length;
      const total = playerCount + enemyCount;
      if (total === 0) {
        setControlPct({ player: 0, enemy: 0 });
      } else {
        setControlPct({ player: Math.round((playerCount / total) * 100), enemy: Math.round((enemyCount / total) * 100) });
      }
    };
    compute();
  }, [troops, structures]);

  // enemy bot runs in a separate module; initialize it once and provide getters/setters
  useEffect(() => {
    const stop = startEnemyBot({
      getStructures: () => structures,
      getTroops: () => troops,
      getEnemyResources: () => enemyResources,
      getGameWinner: () => gameWinner,
      setTroops: (u: any) => setTroops((prev) => (typeof u === "function" ? u(prev) : u)),
      setStructures: (u: any) => setStructures((prev) => (typeof u === "function" ? u(prev) : u)),
      setEnemyResources: (u: any) => setEnemyResources((prev) => (typeof u === "function" ? u(prev) : u)),
      setProjectiles: (u: any) => setProjectiles((prev) => (typeof u === "function" ? u(prev) : u)),
      pushLog,
      nextIdsRef: nextIds,
      VIRTUAL_WIDTH,
      VIRTUAL_HEIGHT,
    });
    return () => stop();
  }, []);

  // compute player's total weapons (global stock + weapons stored in player's houses)
  const playerStored = structures.filter((s) => (s as any).owner !== "enemy").reduce((acc, s: any) => ({
    missile: acc.missile + ((s.weapons && s.weapons.missile) || 0),
    nuke: acc.nuke + ((s.weapons && s.weapons.nuke) || 0),
  }), { missile: 0, nuke: 0 });
  const totalMissiles = (weaponsStock.missile || 0) + playerStored.missile;
  const totalNukes = (weaponsStock.nuke || 0) + playerStored.nuke;

  return (
    <div className="min-h-screen">
      <main className="w-full h-screen p-4">
        <h1 className="text-2xl font-semibold coc-heading mb-4">{gameName ? gameName : "Map — Base verte"}</h1>
        <div className="mb-3 flex items-center gap-4">
          <div className="coc-card px-3 py-2 flex items-center gap-3">
            <div>🌲 {Math.round(resources.wood)}</div>
            <div>💰 {Math.round(resources.gold)}</div>
            <div>⛏️ {Math.round(resources.iron)}</div>
            <div>⛽ {Math.round(resources.petrol)}</div>
          </div>
          <div className="coc-card px-3 py-2 flex items-center gap-3">
            <div className="text-sm">📊 Contrôle — Joueur {controlPct.player}% | Bot {controlPct.enemy}%</div>
          </div>
          <div className="coc-card px-3 py-2 flex items-center gap-3">
              <div>🚀 {totalMissiles}</div>
              <div>💣 {totalNukes}</div>
              <div className="flex gap-2 items-center">
                <button
                  className="coc-btn-outline"
                  onClick={() => {
                    if (totalMissiles > 0) {
                      setWeaponTargetMode({ kind: "missile" });
                      setStatus("Choisissez une cible pour missile");
                    } else setStatus("Aucun missile en stock");
                  }}
                >
                  Lancer missile
                </button>
                <button
                  className="coc-btn-outline"
                  onClick={() => {
                    if (totalNukes > 0) {
                      setWeaponTargetMode({ kind: "nuke" });
                      setStatus("Choisissez une cible pour bombe");
                    } else setStatus("Aucune bombe en stock");
                  }}
                >
                  Lancer bombe
                </button>
                {weaponTargetMode && (
                  <button className="coc-btn-outline text-red-600" onClick={cancelWeaponTargeting}>
                    Annuler ciblage
                  </button>
                )}
                {weaponPendings.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {weaponPendings.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="text-sm">{p.kind} → {p.target ? `${Math.round(p.target.x)},${Math.round(p.target.y)}` : "..."}</div>
                        <button className="coc-btn text-red-700" onClick={() => cancelWeaponPending(p.id)}>Annuler tir</button>
                      </div>
                    ))}
                    <button className="coc-btn-outline text-red-600" onClick={() => cancelWeaponPending()}>
                      Annuler tous les tirs
                    </button>
                  </div>
                )}
              </div>
            </div>
        </div>
        <div className="mb-4 flex gap-4 h-[calc(100vh-140px)]">
          <aside className="w-40">
            <div className="mb-2 font-semibold">Mini-map</div>
            <canvas ref={miniCanvasRef} width={220} height={220} className="border mb-3 w-full h-auto" onClick={(e) => {
              const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
              const cx = e.clientX - rect.left;
              const cy = e.clientY - rect.top;
              const relX = cx / rect.width;
              const relY = cy / rect.height;
              const centerWorldX = relX * VIRTUAL_WIDTH;
              const centerWorldY = relY * VIRTUAL_HEIGHT;
              const viewW = (canvasRef.current?.width || 800) / scale;
              const viewH = (canvasRef.current?.height || 600) / scale;
              const desiredX = centerWorldX - viewW / 2;
              const desiredY = centerWorldY - viewH / 2;
              setOffset(clampOffset(desiredX, desiredY, viewW, viewH));
              setSelectedStructureIndex(null);
            }} />
            <div className="mb-2 font-semibold">Structures</div>
            <button
              className="w-full text-left p-2 mb-2 coc-card bg-red-50 text-red-700"
              onClick={() => {
                setSelectedStructure(null);
                setPendingPlace(null);
                setShowCommentPrompt(false);
                setCommentText("");
                setPreviewPos(null);
                setHoveredLabel(null);
                setSelectedTroopIds([]);
              }}
            >
              Annuler la sélection
            </button>
            <button
              className={`w-full text-left p-2 mb-2 coc-card ${multiSelectMode ? "ring-2 ring-green-400" : ""}`}
              onClick={() =>
                setMultiSelectMode((prev) => {
                  const next = !prev;
                  setStatus(next ? "Mode sélection multiple activé" : "Mode sélection multiple désactivé");
                  return next;
                })
              }
            >
              Sélection multiple
            </button>
            {selectedStructureIndex !== null && (() => {
              const sel = structures[selectedStructureIndex];
              const isEnemy = sel?.owner === "enemy";
              return (
                <button
                  className={isEnemy ? "w-full text-left p-2 mb-2 coc-card bg-gray-200 text-slate-500" : "w-full text-left p-2 mb-2 coc-card bg-red-600 text-white"}
                  onClick={() => !isEnemy && handleDeleteStructure(selectedStructureIndex)}
                  disabled={isEnemy}
                >
                  <i className="fa-solid fa-trash mr-2" /> {isEnemy ? "Suppression bloquée (ennemi)" : "Supprimer la maison sélectionnée"}
                </button>
              );
            })()}
            <div className="text-sm text-slate-600">Sélectionne puis clique sur la carte pour placer.</div>
          </aside>
          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              className="border w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
              onWheel={handleWheel}
            />
            {/* delete button displayed in sidebar when a structure is selected */}
          </div>
          <aside className="w-40">
            <div className="mb-2 font-semibold">Construire</div>
            <div className="mb-3">
              {[{ key: "maison_centrale", label: "Maison centrale" }, ...availableBuildings].map((b) => (
                <button
                  key={b.key}
                  className={`w-full text-left p-2 mb-2 coc-card ${rightSelectedBuilding === b.key ? "ring-2 ring-green-400" : ""}`}
                  onClick={() => {
                    setSelectedStructure(b.key);
                    setRightSelectedBuilding(b.key);
                    setStatus(`${b.label} sélectionnée pour placement`);
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="mb-2 font-semibold">Options</div>
            {selectedStructureIndex !== null ? (
              (() => {
                const t = structures[selectedStructureIndex]?.type;
                if (t === "maison_centrale") {
                  return (
                    <div>
                      <div className="text-sm font-medium mb-2">Bâtiments disponibles</div>
                      {availableBuildings.map((b) => (
                        <button
                          key={b.key}
                          className={`w-full text-left p-2 mb-2 coc-card ${rightSelectedBuilding === b.key ? "ring-2 ring-green-400" : ""}`}
                          onClick={() => {
                            setSelectedStructure(b.key);
                            setRightSelectedBuilding(b.key);
                            setStatus(`${b.label} sélectionnée pour placement`);
                          }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  );
                }
                if (t === "maison_troupe") {
                  return (
                    <div>
                      <div className="text-sm font-medium mb-2">Troupes disponibles</div>
                      <div className="text-sm text-slate-600 mb-2">La maison de troupe fournit uniquement le <strong>Camion missile</strong>.</div>
                      <button className="w-full text-left p-2 mb-2 coc-card bg-yellow-100" onClick={() => purchaseTroop("missile_truck")}>Camion missile — 30G/10Fe</button>
                    </div>
                  );
                }
                if (t === "maison_missile") {
                  return (
                    <div>
                      <div className="text-sm font-medium mb-2">Missiles</div>
                      <button className="w-full text-left p-2 mb-2 coc-card bg-gray-100" onClick={() => purchaseWeapon("missile")}>Missile — 20G/8Fe</button>
                      <button className="w-full text-left p-2 mb-2 coc-card bg-gray-200" onClick={() => purchaseWeapon("missile")}>Missile longue — 20G/8Fe</button>
                    </div>
                  );
                }
                if (t === "maison_nucleaire") {
                  return (
                    <div>
                      <div className="text-sm font-medium mb-2">Charges</div>
                      <button className="w-full text-left p-2 mb-2 coc-card bg-purple-100" onClick={() => purchaseWeapon("nuke")}>Bombe nucléaire — 120G/60Fe</button>
                      <button className="w-full text-left p-2 mb-2 coc-card bg-purple-200" onClick={() => purchaseWeapon("nuke")}>Bombe lourde — 120G/60Fe</button>
                    </div>
                  );
                }
                return <div className="text-sm text-slate-600">Sélectionne une maison placée pour afficher les options spécifiques (ex: maison_troupe).</div>;
              })()
            ) : (
              <div className="text-sm text-slate-600">Sélectionne une maison placée pour afficher les options spécifiques (ex: maison_troupe).</div>
            )}
          </aside>
        </div>
        {/* gameName is collected via the initial prompt/modal; no inline name input here */}
        <div className="flex gap-2 mb-6">
          <button onClick={handleSave} className="coc-btn">Sauvegarder</button>
          <button onClick={handleQuit} className="coc-btn-outline">Quitter</button>
        </div>

        {status && <div className="mb-4 text-sm text-green-800">{status}</div>}
        <div className="mb-4">
          <div className="font-semibold mb-1">Journal du Bot</div>
          <div className="coc-card p-2 max-h-36 overflow-auto text-sm bg-white">
            {logMessages.length === 0 ? <div className="text-slate-500">Aucune entrée</div> : null}
            {logMessages.map((m, i) => (
              <div key={i} className="mb-1">- {m}</div>
            ))}
            <div className="mt-2 text-xs text-slate-400">Ressources bot: 💰{Math.round(enemyResources.gold)} ⛏️{Math.round(enemyResources.iron)}</div>
          </div>
        </div>
        {/* Name prompt modal */}
        {showNamePrompt && (
          <div className="fixed inset-0 flex items-center justify-center">
            <div className="bg-white p-6 coc-card max-w-md w-full">
              <h2 className="font-semibold mb-2">Donne un nom à ta partie</h2>
              <input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Nom de la partie (ex: Royaume)" className="border p-2 w-full mb-4" />
              <div className="flex gap-2 justify-end">
                <button
                  className="coc-btn-outline"
                  onClick={() => {
                    setShowNamePrompt(false);
                    router.push("/home");
                  }}
                >
                  Annuler
                </button>
                <button
                  className="coc-btn"
                  onClick={() => {
                    if (!gameName || gameName.trim().length === 0) return setStatus("Le nom est requis");
                    setShowNamePrompt(false);
                    setStatus(null);
                  }}
                >
                  Commencer
                </button>
              </div>
            </div>
          </div>
        )}
        {showCommentPrompt && (
          <div className="fixed inset-0 flex items-center justify-center">
            <div className="bg-white p-6 coc-card max-w-md w-full">
              <h2 className="font-semibold mb-2">Commentaire pour {pendingPlace?.type}</h2>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Commentaire (optionnel)"
                className="border p-2 w-full mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  className="coc-btn-outline"
                  onClick={() => {
                    setShowCommentPrompt(false);
                    setPendingPlace(null);
                    setCommentText("");
                    setSelectedStructure(null);
                  }}
                >
                  Annuler
                </button>
                <button className="coc-btn-outline" onClick={() => confirmPlace(false)}>
                  Placer sans commentaire
                </button>
                <button className="coc-btn" onClick={() => confirmPlace(true)}>
                  Placer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
