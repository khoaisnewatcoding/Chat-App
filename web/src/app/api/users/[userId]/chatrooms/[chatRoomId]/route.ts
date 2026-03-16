import { NextRequest, NextResponse } from "next/server";
import { allUsersExist } from "@/lib/server/users";
import { getChatRoomForUser } from "@/lib/server/chatrooms";

type RouteContext = {
  params: Promise<{
    userId: string;
    chatRoomId: string;
  }>;
};

// Returns the room metadata for one user-scoped chat room.
export async function GET(
  _request: NextRequest,
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

    const chatRoom = await getChatRoomForUser(userId, chatRoomId);

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ chatRoom }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch chat room:", error);

    return NextResponse.json(
      { error: "Failed to fetch chat room." },
      { status: 500 },
    );
  }
}