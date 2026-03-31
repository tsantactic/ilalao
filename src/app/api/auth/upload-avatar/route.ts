import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = form.get("email")?.toString();
    const file = form.get("avatar") as File | null;
    if (!email || !file) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);

    const avatarUrl = `/uploads/${filename}`;
    const user = await prisma.user.update({ where: { email }, data: { avatarUrl } });
    return NextResponse.json({ success: true, user: { email: user.email, avatarUrl: user.avatarUrl } });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
