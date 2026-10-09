export function samples() {
  const count = 48;
  const values = Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) / count;
    return { index: i, x, value: 0.55 + 0.27 * Math.sin(2 * Math.PI * x) + 0.13 * Math.cos(6 * Math.PI * x) };
  });
  const sorted = [...values].sort((a, b) => b.value - a.value || a.index - b.index);
  return values.map((v) => ({ ...v, rank: sorted.findIndex((s) => s.index === v.index) }));
}
export function createProfile() {
  const data = samples();
  const start = 39;
  const step = 12;
  const baseline = 357;
  const scale = 275;
  const threshold = baseline - 0.55 * scale;
  return `<svg class="profile-chart" viewBox="0 0 640 425" role="img" aria-labelledby="profile-title profile-description" xmlns="http://www.w3.org/2000/svg">
<title id="profile-title">A finite rearrangement of a positive sample profile</title>
<desc id="profile-description">48 samples of 0.55 plus 0.27 sine of 2 pi x plus 0.13 cosine of 6 pi x. The same values move from their original positions into decreasing rank. Their heights and the count above the fixed threshold do not change.</desc>
<text class="chart-label" x="20" y="78">u</text>
<line class="chart-threshold" x1="30" y1="${threshold}" x2="616" y2="${threshold}"/>
<text class="chart-label" x="13" y="${threshold + 4}">t</text>
${data.map(({ index, value, rank }) => {
  const y = baseline - value * scale;
  const original = start + index * step;
  const ordered = start + rank * step;
  return `<g class="profile-sample${index === 17 ? ' sample-highlight' : ''}" data-value="${value.toFixed(12)}" data-original="${original}" data-ordered="${ordered}" data-rank="${rank}" transform="translate(${original},0)"><line class="sample-line" x1="0" y1="${baseline}" x2="0" y2="${y.toFixed(3)}"/><circle class="sample-point" cx="0" cy="${y.toFixed(3)}" r="1.65"/></g>`;
}).join('\n')}
<line class="chart-baseline" x1="30" y1="${baseline}" x2="616" y2="${baseline}"/>
<text class="chart-label" x="33" y="386">0</text><text class="chart-label" x="610" y="386">1</text>
<text class="chart-label" x="320" y="404" text-anchor="middle" data-chart-axis>original position</text>
</svg>`;
}
