const siteOrigin = "https://mianstack.com";
const navigationPattern =
  /^\r?\n> 在面栈阅读：\[[^\r\n]*\]\((https:\/\/mianstack\.com\/(?:question\/q-\d{4,}|interview\/mj-(?:nc|xhs)-\d{4}-\d{4,})\/?)\)\r?\n/;

export function onlineReadingUrl(id) {
  const route = /^Q-\d{4,}$/.test(id)
    ? "question"
    : /^MJ-(?:NC|XHS)-\d{4}-\d{4,}$/.test(id)
      ? "interview"
      : /^COL-[A-Z0-9-]+$/.test(id)
        ? "collection"
        : "";
  if (!route) throw new Error(`No online reading route for content id: ${id}`);
  return `${siteOrigin}/${route}/${id.toLowerCase()}`;
}

/** Generated navigation belongs to the Markdown file, not its content body. */
export function stripOnlineReadingLink(body, id) {
  const match = body.match(navigationPattern);
  if (
    !match ||
    (typeof id === "string" && !match[1].replace(/\/$/, "").endsWith(`/${id.toLowerCase()}`))
  )
    return body;
  return body.slice(match[0].length);
}

export function withOnlineReadingLink(text, relativePath = "Markdown document") {
  const match = text.match(/^(---\r?\n([\s\S]*?)\r?\n---)(\r?\n)?([\s\S]*)$/);
  if (!match) throw new Error(`${relativePath}: missing JSON frontmatter`);
  const { id, title } = JSON.parse(match[2]);
  const newline = match[1].includes("\r\n") ? "\r\n" : "\n";
  const label = String(title)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replace(/[`*_]/g, "\\$&")
    .replace(/[\r\n]+/g, " ");
  const navigation = `${newline}> 在面栈阅读：[${label}](${onlineReadingUrl(id)})${newline}`;
  return match[1] + (match[3] || newline) + navigation + stripOnlineReadingLink(match[4]);
}

export function withCollectionReadingUrl(text) {
  const collection = JSON.parse(text);
  const readingUrl = onlineReadingUrl(collection.id);
  if (collection.readingUrl === readingUrl) return text;
  if (Object.hasOwn(collection, "readingUrl"))
    return text.replace(
      /("readingUrl"\s*:\s*)"(?:\\.|[^"\\])*"/,
      (_, prefix) => prefix + JSON.stringify(readingUrl)
    );

  const id = text.match(new RegExp(`"id"\\s*:\\s*"${collection.id}"\\s*,`));
  if (!id) throw new Error(`Cannot locate collection id: ${collection.id}`);
  const offset = id.index + id[0].length;
  const indent = text.slice(0, id.index).match(/(?:^|\r?\n)([ \t]*)$/)?.[1];
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const prefix = indent === undefined ? "" : newline + indent;
  const separator = indent === undefined ? ":" : ": ";
  return (
    text.slice(0, offset) +
    `${prefix}"readingUrl"${separator}${JSON.stringify(readingUrl)},` +
    text.slice(offset)
  );
}
