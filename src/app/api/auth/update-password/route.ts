import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const { email, currentPassword, newPassword } = await request.json();
    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const hash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { email }, data: { password: hash } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
