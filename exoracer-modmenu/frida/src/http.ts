// A tiny HTTP/1.1 server on top of Frida's sockets. Just enough for the menu page and its JSON API.

export interface Request {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
}

export interface Response {
    status?: number;
    type?: string;
    body: string;
}

export type Handler = (req: Request) => Promise<Response> | Response;

const STATUS: Record<number, string> = { 200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error" };

export function utf8Encode(text: string): number[] {
    const binary = unescape(encodeURIComponent(text));
    const bytes = new Array<number>(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function latin1(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode(...bytes.subarray(i, i + 4096));
    return s;
}

function utf8Decode(bytes: Uint8Array): string {
    try {
        return decodeURIComponent(escape(latin1(bytes)));
    } catch {
        return latin1(bytes);
    }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const out = new Uint8Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
}

function headerEnd(buf: Uint8Array): number {
    for (let i = 3; i < buf.length; i++) {
        if (buf[i - 3] === 13 && buf[i - 2] === 10 && buf[i - 1] === 13 && buf[i] === 10) return i + 1;
    }
    return -1;
}

async function readRequest(conn: SocketConnection): Promise<Request | null> {
    let buf: Uint8Array = new Uint8Array(0);
    let end = -1;
    while (end < 0) {
        const chunk = new Uint8Array(await conn.input.read(8192));
        if (chunk.length === 0) return null;
        buf = concat(buf, chunk);
        if (buf.length > 1 << 20) return null;
        end = headerEnd(buf);
    }

    const [requestLine, ...headerLines] = latin1(buf.subarray(0, end)).split("\r\n");
    const [method, path] = requestLine.split(" ");
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
        const i = line.indexOf(":");
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }

    const length = Math.min(parseInt(headers["content-length"] ?? "0", 10) || 0, 1 << 20);
    let body = buf.subarray(end);
    while (body.length < length) {
        const chunk = new Uint8Array(await conn.input.read(length - body.length));
        if (chunk.length === 0) break;
        body = concat(body, chunk);
    }
    return { method: method ?? "GET", path: (path ?? "/").split("?")[0], headers, body: utf8Decode(body.subarray(0, length)) };
}

async function handle(conn: SocketConnection, handler: Handler, log: (msg: string) => void): Promise<void> {
    try {
        const req = await readRequest(conn);
        if (!req) return;
        let res: Response;
        try {
            res = await handler(req);
        } catch (e) {
            log(`HTTP ${req.method} ${req.path} failed: ${(e as Error).stack ?? e}`);
            res = { status: 500, type: "application/json", body: JSON.stringify({ error: String((e as Error).message ?? e) }) };
        }
        const body = utf8Encode(res.body);
        const status = res.status ?? 200;
        const head =
            `HTTP/1.1 ${status} ${STATUS[status] ?? "OK"}\r\n` +
            `Content-Type: ${res.type ?? "text/plain; charset=utf-8"}\r\n` +
            `Content-Length: ${body.length}\r\n` +
            "Cache-Control: no-store\r\nConnection: close\r\n\r\n";
        await conn.output.writeAll(utf8Encode(head).concat(body));
    } finally {
        await conn.close().catch(() => {});
    }
}

/** Listens on 127.0.0.1 (never the network), trying a few ports. Resolves with the port it got. */
export async function serve(firstPort: number, handler: Handler, log: (msg: string) => void): Promise<number> {
    let listener: TcpListener | null = null;
    for (let port = firstPort; port < firstPort + 10 && !listener; port++) {
        try {
            listener = (await Socket.listen({ family: "ipv4", host: "127.0.0.1", port })) as TcpListener;
        } catch (e) {
            log(`Port ${port} is busy (${(e as Error).message}), trying the next one`);
        }
    }
    if (!listener) throw new Error("couldn't open a port for the menu");

    const l = listener;
    (async () => {
        for (;;) {
            const conn = await l.accept();
            handle(conn, handler, log).catch(e => log(`HTTP connection error: ${e}`));
        }
    })().catch(e => log(`HTTP server stopped: ${e}`));
    return l.port;
}
