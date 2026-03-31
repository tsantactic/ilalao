import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const hash = await argon2.hash(password);
    const created = await prisma.user.create({ data: { email, password: hash } });
    // return the user without password
    return NextResponse.json({ success: true, user: { email: created.email, avatarUrl: created.avatarUrl || null } });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
