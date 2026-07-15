type CliOptions = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  showComments: boolean;
  raw: boolean;
};

type ParsedEvent = {
  id?: string;
  event?: string;
  data: string[];
  retry?: string;
};

function printHelp() {
  console.log(`Usage:
  bun run test:sse -- --url <endpoint> [options]

Options:
  --url <value>               SSE endpoint URL. Required.
  --method <value>            HTTP method. Default: GET.
  --header <key:value>        Request header. Repeatable.
  --body <value>              Raw request body.
  --timeout <ms>              Stop after the given milliseconds.
  --show-comments             Print SSE comment frames.
  --raw                       Print raw chunks before parsed events.
  --help                      Show this help text.

Examples:
  bun run test:sse -- --url http://localhost:3000/api/stream
  bun run test:sse -- --url http://localhost:3000/api/stream --header Authorization:Bearer-token
  bun run test:sse -- --url http://localhost:3000/api/stream --timeout 30000 --show-comments
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: "",
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
    showComments: false,
    raw: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--url": {
        options.url = argv[index + 1] ?? "";
        index += 1;
        break;
      }
      case "--method": {
        options.method = (argv[index + 1] ?? "GET").toUpperCase();
        index += 1;
        break;
      }
      case "--header": {
        const headerValue = argv[index + 1] ?? "";
        const separatorIndex = headerValue.indexOf(":");

        if (separatorIndex <= 0) {
          throw new Error(`Invalid header format: ${headerValue}`);
        }

        const key = headerValue.slice(0, separatorIndex).trim();
        const value = headerValue.slice(separatorIndex + 1).trim();
        options.headers[key] = value;
        index += 1;
        break;
      }
      case "--body": {
        options.body = argv[index + 1] ?? "";
        index += 1;
        break;
      }
      case "--timeout": {
        const timeoutValue = Number.parseInt(argv[index + 1] ?? "", 10);

        if (Number.isNaN(timeoutValue) || timeoutValue < 1) {
          throw new Error("--timeout must be a positive integer.");
        }

        options.timeoutMs = timeoutValue;
        index += 1;
        break;
      }
      case "--show-comments": {
        options.showComments = true;
        break;
      }
      case "--raw": {
        options.raw = true;
        break;
      }
      case "--help": {
        printHelp();
        process.exit(0);
      }
      default: {
        throw new Error(`Unknown argument: ${argument}`);
      }
    }
  }

  if (!options.url) {
    throw new Error("--url is required.");
  }

  return options;
}

function parseEventBlock(block: string): { event?: ParsedEvent; comment?: string } {
  const normalizedBlock = block.replace(/\r/g, "");
  const lines = normalizedBlock.split("\n");
  const event: ParsedEvent = { data: [] };
  const comments: string[] = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith(":")) {
      comments.push(line.slice(1).trimStart());
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    switch (field) {
      case "event":
        event.event = value;
        break;
      case "data":
        event.data.push(value);
        break;
      case "id":
        event.id = value;
        break;
      case "retry":
        event.retry = value;
        break;
      default:
        break;
    }
  }

  if (comments.length > 0 && event.data.length === 0 && !event.event && !event.id && !event.retry) {
    return { comment: comments.join("\n") };
  }

  if (event.data.length === 0 && !event.event && !event.id && !event.retry) {
    return {};
  }

  return { event };
}

function printEvent(event: ParsedEvent) {
  const payload = event.data.join("\n");
  const parsedPayload = tryParseJson(payload);

  console.log("--- event ---");

  if (event.event) {
    console.log(`type: ${event.event}`);
  }

  if (event.id) {
    console.log(`id: ${event.id}`);
  }

  if (event.retry) {
    console.log(`retry: ${event.retry}`);
  }

  if (payload.length > 0) {
    console.log("data:");
    console.log(parsedPayload);
  }
}

function tryParseJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

async function streamSse(options: CliOptions) {
  const controller = new AbortController();
  const decoder = new TextDecoder();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (options.timeoutMs) {
    timeoutId = setTimeout(() => {
      console.error(`Timed out after ${options.timeoutMs}ms.`);
      controller.abort();
    }, options.timeoutMs);
  }

  process.on("SIGINT", () => {
    console.error("Stopping stream.");
    controller.abort();
  });

  console.error(`Connecting to ${options.url} with ${options.method}...`);

  const response = await fetch(options.url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    signal: controller.signal,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Request failed with ${response.status} ${response.statusText}\n${bodyText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/event-stream")) {
    console.error(`Warning: content-type is '${contentType}', not 'text/event-stream'.`);
  }

  if (!response.body) {
    throw new Error("Response body is empty.");
  }

  console.error("Connected. Waiting for events... Press Ctrl+C to stop.");

  let buffer = "";

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const textChunk = decoder.decode(value, { stream: true });

      if (options.raw) {
        console.log("--- raw chunk ---");
        console.log(textChunk);
      }

      buffer += textChunk;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsedBlock = parseEventBlock(block);

        if (parsedBlock.comment && options.showComments) {
          console.log(`comment: ${parsedBlock.comment}`);
        }

        if (parsedBlock.event) {
          printEvent(parsedBlock.event);
        }
      }
    }

    if (buffer.trim().length > 0) {
      const parsedBlock = parseEventBlock(buffer);

      if (parsedBlock.comment && options.showComments) {
        console.log(`comment: ${parsedBlock.comment}`);
      }

      if (parsedBlock.event) {
        printEvent(parsedBlock.event);
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
  } finally {
    reader.releaseLock();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    await streamSse(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    printHelp();
    process.exit(1);
  }
}

void main();