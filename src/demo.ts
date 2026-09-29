export function demoGpx(): string {
  const controls = [[114.201,22.599,125],[114.198,22.604,220],[114.200,22.610,390],[114.206,22.613,545],[114.214,22.617,695],[114.220,22.622,835],[114.226,22.619,910],[114.229,22.613,735],[114.225,22.608,590],[114.217,22.606,480],[114.211,22.600,310],[114.205,22.597,180],[114.201,22.599,125]];
  const points: string[] = [];
  for (let i = 0; i < controls.length - 1; i++) {
    const a = controls[i], b = controls[i + 1];
    for (let j = 0; j < 40; j++) {
      const t = j / 40, wiggle = Math.sin(t * Math.PI * 6) * Math.sin(t * Math.PI) * 0.00042;
      const lon = a[0] + (b[0] - a[0]) * t + wiggle, lat = a[1] + (b[1] - a[1]) * t + wiggle / 2;
      points.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>${(a[2] + (b[2] - a[2]) * t + Math.sin(t * 12) * 5).toFixed(1)}</ele><time>${new Date(Date.UTC(2026, 8, 20, 0, 0, (i * 40 + j) * 30)).toISOString()}</time></trkpt>`);
    }
  }
  points.push('<trkpt lat="22.599" lon="114.201"><ele>125</ele><time>2026-09-20T04:00:00Z</time></trkpt>');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Ridgeline demo" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="22.622" lon="114.220"><ele>835</ele><name>山脊观景点（演示）</name></wpt><wpt lat="22.608" lon="114.225"><ele>590</ele><name>休息点（演示）</name></wpt><trk><name>山脊环线 · 演示路线</name><trkseg>${points.join('')}</trkseg></trk></gpx>`;
}
