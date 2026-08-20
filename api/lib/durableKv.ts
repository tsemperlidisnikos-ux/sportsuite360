import { del, get, head, list, put } from '@vercel/blob';
import { Redis } from '@upstash/redis';

function redisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

export function isDurableKvEnabled(): boolean {
  return Boolean(redisClient() || blobToken());
}

export function durableKvBackend(): 'redis' | 'blob' | 'memory' {
  if (redisClient()) return 'redis';
  if (blobToken()) return 'blob';
  return 'memory';
}

/** Path χωρίς % / : ώστε το Blob get/put να συμφωνούν. */
function blobPath(key: string): string {
  const safe = key
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `ss360-kv/${safe || 'key'}.json`;
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

async function parseBlobJson<T>(stream: ReadableStream<Uint8Array> | null): Promise<T | null> {
  if (!stream) return null;
  const text = await streamToText(stream);
  if (!text) return null;
  return JSON.parse(text) as T;
}

async function blobGetByPath<T>(pathname: string, token: string): Promise<T | null> {
  const result = await get(pathname, {
    access: 'private',
    token,
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return parseBlobJson<T>(result.stream);
}

async function blobGetByUrl<T>(url: string, token: string): Promise<T | null> {
  const result = await get(url, {
    access: 'private',
    token,
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return parseBlobJson<T>(result.stream);
}

export async function kvExists(key: string): Promise<boolean> {
  const redis = redisClient();
  if (redis) {
    try {
      return Number(await redis.exists(key)) > 0;
    } catch {
      return false;
    }
  }

  const token = blobToken();
  if (!token) return false;
  const pathname = blobPath(key);
  try {
    const meta = await head(pathname, { token });
    return Boolean(meta?.url);
  } catch {
    try {
      const listed = await list({ prefix: pathname, token, limit: 5 });
      return listed.blobs.some((b) => b.pathname === pathname) || listed.blobs.length > 0;
    } catch {
      return false;
    }
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = redisClient();
  if (redis) {
    try {
      const raw = await redis.get<T>(key);
      if (raw != null) return raw as T;
    } catch {
      /* fall through to blob if configured */
    }
    if (!blobToken()) return null;
  }

  const token = blobToken();
  if (!token) return null;

  const pathname = blobPath(key);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const direct = await blobGetByPath<T>(pathname, token);
      if (direct != null) return direct;
    } catch {
      /* try url / list */
    }

    try {
      const meta = await head(pathname, { token });
      if (meta?.url) {
        const fromHead = await blobGetByUrl<T>(meta.url, token);
        if (fromHead != null) return fromHead;
      }
    } catch {
      /* try list */
    }

    try {
      const listed = await list({ prefix: pathname, token, limit: 8 });
      const hit =
        listed.blobs.find((b) => b.pathname === pathname) ??
        listed.blobs.find((b) => b.pathname.startsWith(pathname.replace(/\.json$/, ''))) ??
        listed.blobs[0];
      if (hit?.url) {
        const fromList = await blobGetByUrl<T>(hit.url, token);
        if (fromList != null) return fromList;
      }
    } catch {
      /* retry */
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const redis = redisClient();
  if (redis) {
    await redis.set(key, value);
    return;
  }

  const token = blobToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN missing');
  }

  const pathname = blobPath(key);
  const body = JSON.stringify(value);
  const uploaded = await put(pathname, body, {
    access: 'private',
    token,
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  // Επαλήθευση: αλλιώς POST «πετυχαίνει» αλλά GET επιστρέφει 404.
  let verified: unknown = null;
  try {
    verified = await blobGetByUrl(uploaded.url, token);
  } catch {
    verified = null;
  }
  if (verified == null) {
    try {
      verified = await blobGetByPath(uploaded.pathname || pathname, token);
    } catch {
      verified = null;
    }
  }
  if (verified == null) {
    throw new Error(`Blob write verification failed for ${pathname}`);
  }
}

export async function kvDel(key: string): Promise<void> {
  const redis = redisClient();
  if (redis) {
    await redis.del(key);
    return;
  }

  const token = blobToken();
  if (!token) return;
  const pathname = blobPath(key);
  try {
    await del(pathname, { token });
  } catch {
    try {
      const listed = await list({ prefix: pathname, token, limit: 5 });
      const urls = listed.blobs.map((b) => b.url);
      if (urls.length) await del(urls, { token });
    } catch {
      // ignore
    }
  }
}

export async function kvIncrementWithExpiry(key: string, windowSeconds: number): Promise<number | null> {
  const redis = redisClient();
  if (!redis) return null;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
}

export async function kvSetIfAbsent(
  key: string,
  value: string,
  expirySeconds: number,
): Promise<boolean | null> {
  const redis = redisClient();
  if (!redis) return null;
  const result = await redis.set(key, value, { nx: true, ex: expirySeconds });
  return result === 'OK';
}

/** Public binary upload for gallery media (returns CDN URL). */
export async function putPublicBinary(
  pathname: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const token = blobToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN missing');
  }
  const uploaded = await put(pathname, body, {
    access: 'public',
    token,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return uploaded.url;
}

