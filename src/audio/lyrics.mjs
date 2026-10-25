/** Shared by the browser and private-media registration. No network lookup or invented timing. */
const timeTag = /\[(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
export function decodeLyrics(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('gb18030').decode(bytes); }
}
export function parseLyrics(raw, source = 'Local lyrics') {
  if (typeof raw !== 'string') return undefined;
  const value = raw.slice(0, 300000).replace(/^\uFEFF/, '');
  const offset = Math.max(-60000, Math.min(60000, Number(value.match(/\[offset:\s*([+-]?\d+)\]/i)?.[1]) || 0)) / 1000;
  const timed = [], plain = [];
  for (const row of value.split(/\r?\n/).slice(0, 3000)) {
    // NetEase's exported credits are structured metadata, not a line of lyrics.
    if (/^\s*\{\s*"t"\s*:/.test(row)) continue;
    const stamps = [...row.matchAll(timeTag)];
    const text = row.replace(timeTag, '').replace(/\[(?:ti|ar|al|by|offset|re|ve|length):[^\]]*\]/gi, '').trim();
    if (!text || /^(?:暂无歌词|没有歌词|纯音乐[，, ]*(?:请欣赏)?|no lyrics(?: available)?|instrumental)[。.\s]*$/i.test(text)) continue;
    if (!stamps.length) { plain.push({ time: null, text }); continue; }
    for (const stamp of stamps) {
      if (Number(stamp[3]) >= 60 || (stamp[1] && Number(stamp[2]) >= 60)) continue;
      const time = Math.max(0, Number(stamp[1] || 0) * 3600 + Number(stamp[2]) * 60 + Number(stamp[3]) + Number((stamp[4] || '').padEnd(3, '0')) / 1000 + offset);
      if (time < 28800) timed.push({ time, text });
    }
  }
  const joined = [], translations = new Set();
  for (const row of timed.sort((a, b) => a.time - b.time)) {
    const last = joined.at(-1);
    if (last?.time === row.time) {
      if (!translations.has(row.text)) { last.text += '\n' + row.text; translations.add(row.text); }
    } else { joined.push({ ...row }); translations.clear(); translations.add(row.text); }
  }
  const lines = joined.length ? joined : plain;
  return lines.length ? { lines, synced: !!joined.length, source } : undefined;
}
export function embeddedLyrics(tags) {
  for (const tag of tags || []) {
    if (tag.text) {
      const parsed = parseLyrics(tag.text, 'Embedded lyrics');
      if (parsed?.synced) return parsed;
    }
    if (tag.syncText?.length && tag.timeStampFormat === 2) {
      const raw = tag.syncText.filter(x => Number.isFinite(x.timestamp)).map(x => {
        const seconds = x.timestamp / 1000;
        return `[${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}]${x.text}`;
      }).join('\n');
      const parsed = parseLyrics(raw, 'Embedded synchronized lyrics');
      if (parsed) return parsed;
    }
  }
  const untimed = (tags || []).find(x => x.text || x.syncText?.length);
  return untimed ? parseLyrics(untimed.text || untimed.syncText.map(x => x.text).join('\n'), 'Embedded lyrics') : undefined;
}
export function lyricIndex(lyrics, seconds, offsetSeconds = 0) {
  if (!lyrics?.synced) return -1;
  const position = seconds + offsetSeconds;
  let low = 0, high = lyrics.lines.length - 1, found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics.lines[mid].time <= position) { found = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return found;
}
