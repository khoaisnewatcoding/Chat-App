import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

type CreateUserBody = {
  email?: string;
  displayName?: string;
  avatarUrl?: string | null;
};
// fetch
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch users:", error);

    return NextResponse.json(
      { error: "Failed to fetch users." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateUserBody;
    // "?" optional chaining
    const email = body.email?.trim().toLowerCase();
    const displayName = body.displayName?.trim();
    const avatarUrl = body.avatarUrl?.trim() || null;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        avatarUrl,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);

    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 },
    );
  }
}
