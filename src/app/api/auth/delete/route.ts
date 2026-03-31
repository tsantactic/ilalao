import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await argon2.verify(user.password, password);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    await prisma.user.delete({ where: { email } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
