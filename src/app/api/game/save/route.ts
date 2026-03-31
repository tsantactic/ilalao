import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { name, owner, data } = await request.json();
    if (!owner || !data || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // If a game with same owner+name exists, update it instead of creating a duplicate
    const existing = await prisma.game.findFirst({ where: { owner, name } });
    if (existing) {
      const now = new Date();
      const updated = await prisma.game.update({ where: { id: existing.id }, data: { data, createdAt: now } });
      return NextResponse.json({ success: true, game: updated, updated: true });
    }

    const game = await prisma.game.create({ data: { name, owner, data, createdAt: new Date() } });
    return NextResponse.json({ success: true, game, updated: false });
  } catch (err) {
    // log error for debugging
    // eslint-disable-next-line no-console
    console.error("/api/game/save error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}
