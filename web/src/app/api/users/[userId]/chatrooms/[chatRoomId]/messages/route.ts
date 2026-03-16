import { NextRequest, NextResponse } from "next/server";
import { ChatSenderType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { isUserInChatRoom } from "@/lib/server/chatrooms";
import { allUsersExist } from "@/lib/server/users";

type RouteContext = {
  params: Promise<{
    userId: string;
    chatRoomId: string;
  }>;
};

type CreateMessageBody = {
  content?: string;
};

const DEFAULT_TAKE = 50;
const MAX_TAKE = 100;

// Returns paginated room messages after verifying membership.
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { userId, chatRoomId } = await context.params;
    const userExists = await allUsersExist([userId]);

    if (!userExists) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    const userIsParticipant = await isUserInChatRoom(userId, chatRoomId);

    if (!userIsParticipant) {
      return NextResponse.json(
        { error: "Chat room not found." },
        { status: 404 },
      );
    }

    const takeParam = request.nextUrl.searchParams.get("take");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const parsedTake = takeParam ? Number.parseInt(takeParam, 10) : DEFAULT_TAKE;
    const take = Number.isNaN(parsedTake)
      ? DEFAULT_TAKE
      : Math.min(Math.max(parsedTake, 1), MAX_TAKE);

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId,
      },
      include: {
        senderUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
    });

    const chronologicalMessages = [...messages].reverse();
    const nextCursor = messages.length === take ? messages[messages.length - 1]?.id ?? null : null;

    return NextResponse.json(
      {
        messages: chronologicalMessages,
        nextCursor,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch messages:", error);

    return NextResponse.json(
      { error: "Failed to fetch messages." },
      { status: 500 },
    );
  }
}

// Stores a new user message in the room after basic validation.
export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { userId, chatRoomId } = await context.params;
    const userExists = await allUsersExist([userId]);

    if (!userExists) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    const userIsParticipant = await isUserInChatRoom(userId, chatRoomId);

    if (!userIsParticipant) {
      return NextResponse.json(
        { error: "Chat room not found." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as CreateMessageBody;
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Message content is required." },
        { status: 400 },
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderType: ChatSenderType.USER,
        senderUserId: userId,
        content,
      },
      include: {
        senderUser: true,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Failed to create message:", error);

    return NextResponse.json(
      { error: "Failed to create message." },
      { status: 500 },
    );
  }
}