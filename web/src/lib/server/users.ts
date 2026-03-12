import { prisma } from "@/lib/server/prisma";

export async function allUsersExist(userIds: string[]) {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
    },
  });

  return users.length === userIds.length;
}
