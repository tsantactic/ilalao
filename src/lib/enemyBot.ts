type BotOpts = {
  getStructures: () => any[];
  getTroops: () => any[];
  getEnemyResources: () => any;
  getGameWinner: () => null | "player" | "enemy";
  setTroops: (updater: any) => void;
  setStructures: (updater: any) => void;
  setEnemyResources: (updater: any) => void;
  pushLog: (s: string) => void;
  nextIdsRef: { current: { troop: number } };
  VIRTUAL_WIDTH: number;
  VIRTUAL_HEIGHT: number;
  setProjectiles?: (updater: any) => void;
};

export function startEnemyBot(opts: BotOpts) {
  const interval = setInterval(() => {
    try {
      if (opts.getGameWinner && opts.getGameWinner()) return;
      const structures = opts.getStructures();
      const troops = opts.getTroops();
      const enemyResources = opts.getEnemyResources();
      const base = structures.find((s) => s.type === "maison_enemy" && (s as any).owner === "enemy");
      if (!base) return;
      const segW = opts.VIRTUAL_WIDTH / 2; // bot uses halves
      // choose the half where player presence is strongest so bot tries to contest
      let bestIdx = 0;
      let bestNeed = -Infinity;
      for (let i = 0; i < 2; i++) {
        const x0 = i * segW;
        const x1 = x0 + segW;
        const playerCount = troops.filter((tr) => (tr as any).owner !== "enemy" && tr.x >= x0 && tr.x < x1).length + structures.filter((s) => (s as any).owner !== "enemy" && s.x >= x0 && s.x < x1).length;
        const enemyCount = troops.filter((tr) => (tr as any).owner === "enemy" && tr.x >= x0 && tr.x < x1).length + structures.filter((s) => (s as any).owner === "enemy" && s.x >= x0 && s.x < x1).length;
        const need = playerCount - enemyCount;
        if (need > bestNeed) {
          bestNeed = need;
          bestIdx = i;
        }
      }
      const targetX = Math.round((bestIdx + 0.5) * segW);
      const targetY = Math.round(opts.VIRTUAL_HEIGHT / 2 + (Math.random() * 200 - 100));
      const cost = { gold: 30, iron: 10 };
      // Prefer using missile houses to attack
      const enemyMissileHouses = structures.map((s, i) => ({ s, i })).filter((x) => x.s.type === "maison_missile" && x.s.owner === "enemy");
      const missileCost = { gold: 20, iron: 8 };
      let fired = false;
      if (opts.setProjectiles && enemyMissileHouses.length > 0) {
        // try to fire from a house that has ammo
        for (const mh of enemyMissileHouses) {
          const weapons = mh.s.weapons || {};
          if ((weapons.missile || 0) > 0) {
            // fire from this house
            const now = performance.now();
            const idp = Date.now() + Math.floor(Math.random() * 9999);
            const fromX = mh.s.x;
            const fromY = mh.s.y;
            const duration = 2000;
            const proj = { id: idp, kind: "missile", fromX, fromY, toX: targetX, toY: targetY, startTime: now, duration };
            opts.setProjectiles((p: any) => [...p, proj]);
            // decrement ammo on that house and mark lastFired
            opts.setStructures((prev: any) => prev.map((z: any, idx: number) => (idx === mh.i ? { ...z, weapons: { ...(z.weapons || {}), missile: Math.max(0, (z.weapons?.missile || 0) - 1) }, lastFired: now } : z)));
            opts.pushLog(`Bot: tir de missile depuis maison ${mh.i} vers moitié ${bestIdx}`);
            fired = true;
            break;
          }
        }
      }
      if (fired) return;
      // if no ammo available, try to buy missile for a random missile house
      if (enemyMissileHouses.length > 0 && enemyResources.gold >= missileCost.gold && enemyResources.iron >= missileCost.iron) {
        const mh = enemyMissileHouses[Math.floor(Math.random() * enemyMissileHouses.length)];
        opts.setStructures((prev: any) => prev.map((z: any, idx: number) => (idx === mh.i ? { ...z, weapons: { ...(z.weapons || {}), missile: (z.weapons?.missile || 0) + 1 } } : z)));
        opts.setEnemyResources((r: any) => ({ ...r, gold: r.gold - missileCost.gold, iron: r.iron - missileCost.iron }));
        opts.pushLog(`Bot: recharge missile sur maison ${mh.i}`);
        return;
      }
      // otherwise build more support buildings
      const choices = ["maison_mine", "maison_troupe"];
      const choice = choices[Math.floor(Math.random() * choices.length)];
      const costs: Record<string, { gold: number; iron: number }> = {
        maison_mine: { gold: 40, iron: 10 },
        maison_troupe: { gold: 60, iron: 20 },
      };
      const cost2 = costs[choice] || { gold: 0, iron: 0 };
      if (enemyResources.gold >= cost2.gold && enemyResources.iron >= cost2.iron) {
        const bx = base.x + (Math.random() * 160 - 80);
        const by = base.y + (Math.random() * 160 - 80);
        opts.setStructures((s: any) => [...s, { type: choice, x: Math.round(bx), y: Math.round(by), hp: 100, owner: "enemy", weapons: {} }]);
        opts.setEnemyResources((r: any) => ({ ...r, gold: r.gold - cost2.gold, iron: r.iron - cost2.iron }));
        opts.pushLog(`Bot: construit ${choice}`);
      }
    } catch (e) {
      // swallow
    }
  }, 7000);

  return () => clearInterval(interval);
}
