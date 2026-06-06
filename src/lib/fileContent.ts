export const BINARY_CONTENT_PREFIX = "__DROWA_BINARY__:";

const BINARY_FILE_RE = /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|webp|ico)$/i;

export function isBinaryFilePath(path: string): boolean {
  return BINARY_FILE_RE.test(path);
}

export function mimeForPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "woff") return "font/woff";
  if (ext === "woff2") return "font/woff2";
  if (ext === "ttf") return "font/ttf";
  if (ext === "otf") return "font/otf";
  if (ext === "eot") return "application/vnd.ms-fontobject";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "ico") return "image/x-icon";
  return "application/octet-stream";
}

export function encodeBinaryContent(path: string, base64: string): string {
  return `${BINARY_CONTENT_PREFIX}${mimeForPath(path)};base64,${base64.replace(/\s/g, "")}`;
}

export function decodeBinaryContent(content: string): { mime: string; base64: string } | null {
  if (!content.startsWith(BINARY_CONTENT_PREFIX)) return null;
  const rest = content.slice(BINARY_CONTENT_PREFIX.length);
  const match = /^([^;]+);base64,([\s\S]+)$/.exec(rest);
  if (!match) return null;
  return { mime: match[1], base64: match[2].replace(/\s/g, "") };
}
