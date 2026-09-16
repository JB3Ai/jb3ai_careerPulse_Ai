#!/usr/bin/env node
/**
 * generate-dashboard.mjs
 * Reads career-ops data files and generates an HTML dashboard.
 * Run: node generate-dashboard.mjs
 * Output: output/dashboard.html
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;

// Read data files
const trackerPath = join(root, 'data', 'applications.md');
const followupsPath = join(root, 'data', 'follow-ups.md');
const pipelinePath = join(root, 'data', 'pipeline.md');

function parseTracker(content) {
  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Company'));
  return lines.map(line => {
    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if (cols.length < 9) return null;
    return {
      num: cols[0],
      date: cols[1],
      company: cols[2],
      role: cols[3],
      score: cols[4],
      status: cols[5],
      pdf: cols[6],
      report: cols[7],
      notes: cols[8],
      url: cols[9] || ''
    };
  }).filter(Boolean);
}

function parseFollowups(content) {
  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Company'));
  return lines.map(line => {
    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if (cols.length < 8) return null;
    return {
      num: cols[0],
      company: cols[1],
      role: cols[2],
      applied: cols[3],
      followup1: cols[4],
      followup2: cols[5],
      followup3: cols[6],
      status: cols[7]
    };
  }).filter(Boolean);
}

function countByStatus(apps) {
  const counts = { Applied: 0, Evaluated: 0, Interview: 0, Offer: 0, Rejected: 0, Discarded: 0 };
  apps.forEach(a => {
    const s = a.status.replace(/[✅❌🟡⏳]/g, '').trim();
    if (counts[s] !== undefined) counts[s]++;
  });
  return counts;
}

function avgScore(apps) {
  const scores = apps.map(a => parseFloat(a.score)).filter(n => !isNaN(n));
  if (scores.length === 0) return 0;
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

const trackerContent = existsSync(trackerPath) ? readFileSync(trackerPath, 'utf8') : '';
const followupsContent = existsSync(followupsPath) ? readFileSync(followupsPath, 'utf8') : '';

const apps = parseTracker(trackerContent);
const followups = parseFollowups(followupsContent);
const statusCounts = countByStatus(apps);
const avg = avgScore(apps);
const today = new Date().toISOString().split('T')[0];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Career-Ops Dashboard — Jonathan Blackburn</title>
<style>
  :root {
    --bg: #0f0f0f;
    --card: #1a1a1a;
    --border: #2a2a2a;
    --text: #e0e0e0;
    --muted: #888;
    --accent: #00d4aa;
    --accent2: #7c3aed;
    --green: #10b981;
    --yellow: #f59e0b;
    --red: #ef4444;
    --blue: #3b82f6;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 24px;
    min-height: 100vh;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .header h1 {
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header .date { color: var(--muted); font-size: 14px; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .stat-card .value {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .stat-card .label {
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stat-card.applied .value { color: var(--green); }
  .stat-card.evaluated .value { color: var(--yellow); }
  .stat-card.interview .value { color: var(--blue); }
  .stat-card.score .value { color: var(--accent); }
  .section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .section h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section h2 .icon { font-size: 20px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    font-weight: 500;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  tr:last-child td { border-bottom: none; }
  tr:hover { background: rgba(255,255,255,0.02); }
  .status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }
  .status-applied { background: rgba(16,185,129,0.15); color: var(--green); }
  .status-evaluated { background: rgba(245,158,11,0.15); color: var(--yellow); }
  .status-interview { background: rgba(59,130,246,0.15); color: var(--blue); }
  .status-preparing { background: rgba(139,92,246,0.15); color: #8b5cf6; }
  .score-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(0,212,170,0.15);
    color: var(--accent);
  }
  .followup-date {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    color: var(--muted);
  }
  .followup-due { color: var(--red); font-weight: 600; }
  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--muted);
  }
  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-size: 13px;
    transition: all 0.2s;
  }
  .action-btn:hover {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }
  .pipeline-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 8px;
  }
  .pipeline-bar .segment {
    transition: width 0.3s;
  }
  .footer {
    text-align: center;
    padding: 24px;
    color: var(--muted);
    font-size: 12px;
  }
  @media (max-width: 768px) {
    body { padding: 16px; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    table { font-size: 12px; }
    th, td { padding: 8px; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Career-Ops Dashboard</h1>
  <div class="date">Generated: ${today} · Jonathan Blackburn</div>
</div>

<div class="stats-grid">
  <div class="stat-card applied">
    <div class="value">${statusCounts.Applied}</div>
    <div class="label">Applied</div>
  </div>
  <div class="stat-card evaluated">
    <div class="value">${statusCounts.Evaluated}</div>
    <div class="label">Ready to Apply</div>
  </div>
  <div class="stat-card interview">
    <div class="value">${statusCounts.Interview}</div>
    <div class="label">Interviewing</div>
  </div>
  <div class="stat-card score">
    <div class="value">${avg}</div>
    <div class="label">Avg Score</div>
  </div>
</div>

<div class="section">
  <h2><span class="icon">📊</span> Pipeline Overview</h2>
  <div class="pipeline-bar">
    ${statusCounts.Applied > 0 ? `<div class="segment" style="width:${(statusCounts.Applied/apps.length*100).toFixed(0)}%;background:var(--green)" title="Applied"></div>` : ''}
    ${statusCounts.Evaluated > 0 ? `<div class="segment" style="width:${(statusCounts.Evaluated/apps.length*100).toFixed(0)}%;background:var(--yellow)" title="Evaluated"></div>` : ''}
    ${statusCounts.Interview > 0 ? `<div class="segment" style="width:${(statusCounts.Interview/apps.length*100).toFixed(0)}%;background:var(--blue)" title="Interview"></div>` : ''}
  </div>
  <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:var(--muted)">
    <span>🟢 Applied ${statusCounts.Applied}</span>
    <span>🟡 Ready ${statusCounts.Evaluated}</span>
    <span>🔵 Interview ${statusCounts.Interview}</span>
  </div>
</div>

<div class="section">
  <h2><span class="icon">📋</span> Applications</h2>
  ${apps.length === 0 ? '<div class="empty-state">No applications yet. Run a scan to get started.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Company</th>
        <th>Role</th>
        <th>Score</th>
        <th>Status</th>
        <th>Date</th>
        <th>Link</th>
      </tr>
    </thead>
    <tbody>
      ${apps.map(a => {
        const statusClass = a.status.includes('Applied') ? 'status-applied' :
                           a.status.includes('Interview') ? 'status-interview' :
                           a.status.includes('Evaluated') ? 'status-evaluated' : 'status-preparing';
        const statusText = a.status.replace(/[✅❌🟡⏳]/g, '').trim();
        return `<tr>
          <td><strong>${a.company}</strong></td>
          <td>${a.role}</td>
          <td><span class="score-pill">${a.score}</span></td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td style="color:var(--muted)">${a.date}</td>
          <td>${a.url ? `<a href="${a.url}" target="_blank" style="color:var(--accent)">View</a>` : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`}
</div>

<div class="section">
  <h2><span class="icon">🔔</span> Follow-Up Schedule</h2>
  ${followups.length === 0 ? '<div class="empty-state">No follow-ups scheduled.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Company</th>
        <th>Role</th>
        <th>Applied</th>
        <th>Follow-Up 1</th>
        <th>Follow-Up 2</th>
        <th>Follow-Up 3</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${followups.map(f => {
        const isDue = f.followup1 && f.followup1 <= today;
        return `<tr>
          <td><strong>${f.company}</strong></td>
          <td>${f.role}</td>
          <td class="followup-date">${f.applied || '—'}</td>
          <td class="followup-date ${isDue ? 'followup-due' : ''}">${f.followup1 || '—'}${isDue ? ' ⚠️' : ''}</td>
          <td class="followup-date">${f.followup2 || '—'}</td>
          <td class="followup-date">${f.followup3 || '—'}</td>
          <td><span class="status-badge status-preparing">${f.status.replace(/[🟡⏳]/g, '').trim()}</span></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`}
</div>

<div class="section">
  <h2><span class="icon">⚡</span> Quick Actions</h2>
  <div class="actions">
    <a href="output/outreach-top5.md" class="action-btn">📧 View Outreach Emails</a>
    <a href="data/pipeline.md" class="action-btn">🔍 View Pipeline</a>
    <a href="output/daily-report-${today}.md" class="action-btn">📊 Latest Daily Report</a>
  </div>
</div>

<div class="footer">
  Career-Ops Dashboard · Auto-generated · Refresh by running <code>node generate-dashboard.mjs</code>
</div>

</body>
</html>`;

const outputPath = join(root, 'output', 'dashboard.html');
writeFileSync(outputPath, html);
console.log(`Dashboard generated: ${outputPath}`);
