import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, avatarUrl } = await request.json();
    if (!email || !avatarUrl) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { email }, data: { avatarUrl } });
    return NextResponse.json({ success: true, user: { email: user.email, avatarUrl: user.avatarUrl } });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
