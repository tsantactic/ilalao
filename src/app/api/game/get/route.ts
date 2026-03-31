import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "id required" }, { status: 400 });
    const id = Number(idParam);
    if (Number.isNaN(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true, game });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
