import { prisma } from "@/lib/server/prisma";

// Loads a single room only if the given user belongs to it.
export async function getChatRoomForUser(userId: string, chatRoomId: string) {
  return prisma.chatRoom.findFirst({
    where: {
      id: chatRoomId,
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
  });
}

// Checks membership without loading the full room payload.
export async function isUserInChatRoom(userId: string, chatRoomId: string) {
  const participant = await prisma.chatParticipant.findUnique({
    where: {
      chatRoomId_userId: {
        chatRoomId,
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(participant);
}