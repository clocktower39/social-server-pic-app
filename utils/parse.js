const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;
const MENTION_REGEX = /@([a-zA-Z0-9_.]+)/g;

const extractHashtags = (text) => {
  if (!text || typeof text !== "string") return [];
  const set = new Set();
  let match;
  const regex = new RegExp(HASHTAG_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    set.add(match[1].toLowerCase());
  }
  return Array.from(set);
};

const extractMentionUsernames = (text) => {
  if (!text || typeof text !== "string") return [];
  const set = new Set();
  let match;
  const regex = new RegExp(MENTION_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    set.add(match[1].toLowerCase());
  }
  return Array.from(set);
};

const renderTextWithLinks = (text) => {
  if (!text) return [];
  const parts = [];
  const combined = new RegExp(
    `${HASHTAG_REGEX.source}|${MENTION_REGEX.source}`,
    "g"
  );
  let lastIndex = 0;
  let match;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[0].startsWith("#")) {
      parts.push({ type: "hashtag", value: match[1], raw: match[0] });
    } else {
      parts.push({ type: "mention", value: match[1], raw: match[0] });
    }
    lastIndex = combined.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
};

module.exports = {
  extractHashtags,
  extractMentionUsernames,
  renderTextWithLinks,
  HASHTAG_REGEX,
  MENTION_REGEX,
};
