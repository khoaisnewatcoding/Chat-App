type SseMessage = {
  event?: string;
  data?: unknown;
  id?: string;
  retry?: number;
  comment?: string;
};

type SseSubscriber = (message: SseMessage) => void;

// Keep SSE subscribers in a global singleton so hot reloads do not reset active listeners.
const globalForSse = globalThis as typeof globalThis & {
  sseSubscribers?: Map<string, Map<symbol, SseSubscriber>>;
};

const subscribers = globalForSse.sseSubscribers ?? new Map<string, Map<symbol, SseSubscriber>>();

if (!globalForSse.sseSubscribers) {
  globalForSse.sseSubscribers = subscribers;
}

function getOrCreateUserSubscribers(userId: string) {
  const existingSubscribers = subscribers.get(userId);

  if (existingSubscribers) {
    return existingSubscribers;
  }

  const userSubscribers = new Map<symbol, SseSubscriber>();
  subscribers.set(userId, userSubscribers);
  return userSubscribers;
}

export function formatSseMessage(message: SseMessage) {
  // Convert structured event data into the plain text format required by SSE.
  if (message.comment !== undefined) {
    return `: ${message.comment}\n\n`;
  }

  const lines: string[] = [];

  if (message.id) {
    lines.push(`id: ${message.id}`);
  }

  if (message.event) {
    lines.push(`event: ${message.event}`);
  }

  if (message.retry !== undefined) {
    lines.push(`retry: ${message.retry}`);
  }

  if (message.data !== undefined) {
    const payload =
      typeof message.data === "string"
        ? message.data
        : JSON.stringify(message.data);

    for (const payloadLine of payload.split(/\r?\n/)) {
      lines.push(`data: ${payloadLine}`);
    }
  }

  return `${lines.join("\n")}\n\n`;
}

export function subscribeUser(userId: string, subscriber: SseSubscriber) {
  // Register one live connection for a user and return a cleanup function for disconnects.
  const subscriberId = Symbol(userId);
  const userSubscribers = getOrCreateUserSubscribers(userId);
  userSubscribers.set(subscriberId, subscriber);

  return () => {
    const currentSubscribers = subscribers.get(userId);

    if (!currentSubscribers) {
      return;
    }

    currentSubscribers.delete(subscriberId);

    if (currentSubscribers.size === 0) {
      subscribers.delete(userId);
    }
  };
}

export function publishToUser(userId: string, message: SseMessage) {
  // Fan one event out to every active stream opened by this user.
  const userSubscribers = subscribers.get(userId);

  if (!userSubscribers) {
    return;
  }

  for (const subscriber of userSubscribers.values()) {
    subscriber(message);
  }
}

export function publishToUsers(userIds: string[], message: SseMessage) {
  // Deduplicate user ids so the same browser does not receive duplicate events.
  for (const userId of new Set(userIds)) {
    publishToUser(userId, message);
  }
}