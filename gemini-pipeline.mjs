#!/usr/bin/env node
/**
 * gemini-pipeline.mjs — Gemini-powered Pipeline Evaluator (no OpenRouter)
 *
 * Reads pending URLs from data/pipeline.md, fetches each JD,
 * evaluates it against your career profile using Google Gemini,
 * and writes scored results to output/pipeline-scored.json.
 *
 * Usage:
 *   node gemini-pipeline.mjs              → Evaluate ALL pending listings
 *   node gemini-pipeline.mjs --limit 10   → Evaluate first 10 only
 *
 * Requires: GEMINI_API_KEY in .env
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildBudgetedPrompt } from './lib/context-budget.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Bootstrap: load .env before anything else
// ---------------------------------------------------------------------------
try {
  const { config } = await import('dotenv');
  config({ path: join(__dirname, '.env') });
} catch { /* no dotenv */ }

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY not found in .env');
  process.exit(1);
}

const PATHS = {
  shared:    join(__dirname, 'modes', '_shared.md'),
  oferta:    join(__dirname, 'modes', 'oferta.md'),
  cv:        join(__dirname, 'cv.md'),
  profile:   join(__dirname, 'modes', '_profile.md'),
};

for (const [key, p] of Object.entries(PATHS)) {
  if (!existsSync(p)) {
    console.error(`Error: Missing required file: ${p}`);
    process.exit(1);
  }
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-3.6-flash',
  temperature: 0.1,
  maxOutputTokens: 8192,
});

const MODE_SHARED = readFileSync(PATHS.shared, 'utf-8');
const MODE_OFERTA = readFileSync(PATHS.oferta, 'utf-8');
const CV_TEXT = readFileSync(PATHS.cv, 'utf-8');
const PROFILE_YML = readFileSync(join(__dirname, 'config', 'profile.yml'), 'utf-8');
const PROFILE_TEXT = existsSync(PATHS.profile) ? readFileSync(PATHS.profile, 'utf-8') : '';

// ---------------------------------------------------------------------------
// Scoring parser — reads Gemini markdown report format
// ---------------------------------------------------------------------------
function parseGeminiOutput(output, entry) {
  const summaryMatch = output.match(/SCORE_SUMMARY[\s\S]*?(?:---(?:END_)?SUMMARY---)/);
  if (!summaryMatch) return { ...entry, score: 0, fit: 0, matched: [], notes: 'No SCORE_SUMMARY', skipped: true };

  const summary = summaryMatch[0];

  // Score is 0-5 in Gemini eval; scale to 100 for dashboard compatibility
  const scoreMatch = summary.match(/^\s*SCORE:\s*(\d+(?:\.\d+)?)\s*$/m);
  const numericScore = scoreMatch ? Number(scoreMatch[1]) : 0;
  const overallScore = numericScore * 20; // Scale 0-5 → 0-100

  // Archetype matching
  const archetypeMatch = summary.match(/^\s*ARCHETYPE:\s*(.+)$/mi);
  const archetype = archetypeMatch?.[1]?.trim() || '';

  // Matched keywords from body
  const kwMatch = output.match(/MATCHED_KEYWORDS\s*([\s\S]*?)(?=\n\n[A-Z]|---)/i);
  const matched = kwMatch
    ? kwMatch[1].split('\n').map(l => l.replace(/^[-*\u2022]\s*/, '').trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    ...entry,
    score: overallScore,
    fit: Math.round(numericScore / 5 * 50) / 10, // Scale 0-5 → 0-5 for fit
    matched,
    archetype,
    notes: summary.substring(0, 500),
    jd_preview: null,
  };
}

// ---------------------------------------------------------------------------
// Fetching & parsing
// ---------------------------------------------------------------------------
async function fetchJD(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    return html.replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<[^>]+>/g, '\n')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/\s+/g, ' ')
               .trim();
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

function parseEntry(line) {
  const match = line.match(
    /^\-\s*\[\s*\]\s+(https?:\/\/\S+)\s*\|\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*posted:\s*(\d{4}-\d{2}-\d{2}))?\s*$/
  );
  if (!match) return null;
  return { url: match[1], company: match[2].trim(), role: match[3].trim(), posted: match[4] || 'unknown' };
}

function readPending() {
  const pipeline = readFileSync(join(__dirname, 'data', 'pipeline.md'), 'utf-8');
  const lines = pipeline.split('\n');
  const pending = [];

  let inPending = false;
  for (const line of lines) {
    if (line.includes('## Pending')) { inPending = true; continue; }
    if (line.startsWith('## ') && inPending) break;
    if (!inPending) continue;
    if (!line.trim().startsWith('- [')) continue;
    const entry = parseEntry(line);
    if (entry) pending.push(entry);
  }

  return pending;
}

// ---------------------------------------------------------------------------
// Evaluate single job
// ---------------------------------------------------------------------------
async function evaluate(entry) {
  const jd = await fetchJD(entry.url);
  if (!jd) return { ...entry, score: 0, fit: 0, matched: [], notes: 'Fetch failed', skipped: true };

  // Build budgeted prompt using the same approach as gemini-eval.mjs
  const { contextBody, budgetReport } = buildBudgetedPrompt({
    sharedContent: MODE_SHARED,
    ofertaContent: MODE_OFERTA,
    cvContent: CV_TEXT,
    profileYml: PROFILE_YML,
    profileContent: PROFILE_TEXT,
    jdText: jd,
    noCompress: false,
    maxTokens: 786432, // gemini-3.6-flash context window
  });

  const languageInstruction = 'Respond in English.';

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

${contextBody}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. ${languageInstruction}
3. Generate Blocks A through G in full.
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

  try {
    const result = await model.generateContent(systemPrompt + '\n\nJOB DESCRIPTION TO EVALUATE:\n\n' + jd);
    const output = result.response.text();

    if (output.includes('SCORE_SUMMARY')) {
      return parseGeminiOutput(output, entry);
    } else {
      console.log(`  ⚠ No SCORE_SUMMARY — raw preview: ${output.substring(0, 150)}`);
      return { ...entry, score: 0, fit: 0, matched: [], notes: 'No SCORE_SUMMARY', skipped: true };
    }
  } catch (err) {
    console.warn(`  ❌ Gemini error: ${err.message}`);
    return { ...entry, score: 0, fit: 0, matched: [], notes: `Gemini error: ${err.message}`, skipped: true };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Gemini Pipeline Evaluator');
  console.log('=========================\n');

  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1] || '10')
    : null;

  const pending = readPending();
  const entries = limit ? pending.slice(0, limit) : pending;

  console.log(`Processing ${entries.length} listing(s)...\n`);

  const scored = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    console.log(`[${i + 1}/${entries.length}] ${entry.company} — ${entry.role}`);

    const result = await evaluate(entry);
    scored.push(result);

    if (!result.skipped) {
      console.log(`  ✓ Score: ${result.score}/100 | Fit: ${result.fit}/5 | Archetype: ${result.archetype || 'N/A'}`);
    } else {
      console.log(`  ✗ Skipped (${result.notes})`);
    }

    // Save checkpoint after each job
    mkdirSync(join(__dirname, 'output'), { recursive: true });
    writeFileSync(join(__dirname, 'output', 'pipeline-scored.json'), JSON.stringify(scored, null, 2));

    // Rate limiting
    if (i < entries.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Summary
  const total = scored.filter(s => !s.skipped).length;
  const avgScore = total > 0
    ? (scored.filter(s => !s.skipped).reduce((sum, s) => sum + s.score, 0) / total).toFixed(1)
    : 'N/A';
  const highFit = scored.filter(s => !s.skipped && s.score >= 70).length;

  console.log(`\n✅ Evaluation complete!`);
  console.log(`   Total processed: ${total}/${entries.length}`);
  console.log(`   Average score: ${avgScore}/100`);
  console.log(`   High-fit (≥70): ${highFit}`);
  console.log(`   Results saved to: output/pipeline-scored.json`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
