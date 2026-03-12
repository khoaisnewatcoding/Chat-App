import { NextRequest, NextResponse } from "next/server";
import { ChatParticipantRole, ChatRoomType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { allUsersExist } from "@/lib/server/users";

type CreateChatRoomBody = {
  type?: ChatRoomType;
  title?: string;
  participantUserIds?: string[];
  aiEnabled?: boolean;
};

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    // Read the user ID from the route so the endpoint is clearly user-scoped.
    const { userId } = await context.params;

    // Reuse shared validation to make sure the requested user exists first.
    const userExists = await allUsersExist([userId]);

    if (!userExists) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    // Return every chat room where the user is a participant.
    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: true,
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ chatRooms }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch chat rooms:", error);

    return NextResponse.json(
      { error: "Failed to fetch chat rooms." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    // Parse the incoming JSON body and use the path user as the creator.
    const body = (await request.json()) as CreateChatRoomBody;
    const { userId } = await context.params;
    const type = body.type;
    const title = body.title?.trim() || null;
    const participantUserIds = [...new Set(body.participantUserIds ?? [])];
    const aiEnabled = body.aiEnabled ?? true;

    if (!type || !Object.values(ChatRoomType).includes(type)) {
      return NextResponse.json(
        { error: "Valid room type is required." },
        { status: 400 },
      );
    }

    // Merge the creator into the participant list and remove duplicates.
    const allParticipantIds = [...new Set([userId, ...participantUserIds])];

    // Room-specific validation rules.
    if (type === ChatRoomType.DM && allParticipantIds.length !== 2) {
      return NextResponse.json(
        { error: "DM rooms must have exactly 2 unique participants." },
        { status: 400 },
      );
    }

    if (type === ChatRoomType.GROUP && allParticipantIds.length < 2) {
      return NextResponse.json(
        { error: "Group rooms must have at least 2 participants." },
        { status: 400 },
      );
    }

    if (type === ChatRoomType.GROUP && !title) {
      return NextResponse.json(
        { error: "Group rooms require a title." },
        { status: 400 },
      );
    }

    // Reuse shared user validation so all participant IDs must be valid.
    const participantsExist = await allUsersExist(allParticipantIds);

    if (!participantsExist) {
      return NextResponse.json(
        { error: "One or more participant users do not exist." },
        { status: 404 },
      );
    }

    // For DMs, reuse an existing room between the same two people.
    if (type === ChatRoomType.DM) {
      const existingDm = await prisma.chatRoom.findFirst({
        where: {
          type: ChatRoomType.DM,
          participants: {
            every: {
              userId: { in: allParticipantIds },
            },
          },
        },
        include: {
          participants: true,
        },
      });

      if (existingDm && existingDm.participants.length === 2) {
        const existingIds = existingDm.participants
          .map((participant) => participant.userId)
          .sort();
        const requestedIds = [...allParticipantIds].sort();

        if (JSON.stringify(existingIds) === JSON.stringify(requestedIds)) {
          return NextResponse.json({ chatRoom: existingDm }, { status: 200 });
        }
      }
    }

    // Create the room and its participant records in one transaction.
    const chatRoom = await prisma.$transaction(async (tx) => {
      return tx.chatRoom.create({
        data: {
          type,
          title: type === ChatRoomType.DM ? null : title,
          aiEnabled,
          participants: {
            create: allParticipantIds.map((participantUserId) => ({
              userId: participantUserId,
              role:
                participantUserId === userId
                  ? ChatParticipantRole.ADMIN
                  : ChatParticipantRole.MEMBER,
            })),
          },
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ chatRoom }, { status: 201 });
  } catch (error) {
    console.error("Failed to create chat room:", error);

    return NextResponse.json(
      { error: "Failed to create chat room." },
      { status: 500 },
    );
  }
}