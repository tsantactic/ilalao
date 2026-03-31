import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });

    const games = await prisma.game.findMany({ where: { owner }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, games });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
