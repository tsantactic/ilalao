import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { id, owner } = await request.json();
    if (!id || !owner) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.owner !== owner) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    await prisma.game.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
