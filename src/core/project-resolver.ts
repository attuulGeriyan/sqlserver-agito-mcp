// Maps a project name (e.g. "RobotiMaster") to the database that backs it
// (e.g. "MTMRobot") by fuzzy-matching against databases actually present on
// the server. Always pairs the result with shared databases (MTMCore) when
// available.

const SHARED_DB_CANDIDATES = ["MTMCore"];
const MTM_PREFIX = "MTM";

export interface ResolvedProject {
  project: string | null;
  shared: string[];
  reasoning: string;
}

// Explicit overrides via env var: MCP_PROJECT_OVERRIDES='{"RobotiMaster":"MTMRobot"}'
const loadOverrides = (): Record<string, string> => {
  const raw = process.env.MCP_PROJECT_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore malformed
  }
  return {};
};

const findCaseInsensitive = (haystack: string[], needle: string): string | undefined =>
  haystack.find((d) => d.toLowerCase() === needle.toLowerCase());

// Score how well an MTM-stem aligns with a project name. Higher is better.
// "Robot" against "RobotiMaster" -> 5 (project starts with stem, length 5)
// "RobotiMaster" against "Robot" -> 5 (stem starts with project, length 5)
const stemScore = (stem: string, project: string): number => {
  const s = stem.toLowerCase();
  const p = project.toLowerCase();
  if (p.startsWith(s)) return s.length;
  if (s.startsWith(p)) return p.length;
  return 0;
};

export const resolveProjectDatabases = (
  projectName: string,
  availableDbs: string[]
): ResolvedProject => {
  const overrides = loadOverrides();
  const shared = SHARED_DB_CANDIDATES
    .map((s) => findCaseInsensitive(availableDbs, s))
    .filter((s): s is string => !!s);

  if (!projectName || !projectName.trim()) {
    return {
      project: null,
      shared,
      reasoning: "No project name supplied.",
    };
  }

  const trimmed = projectName.trim();

  // 1. Explicit override
  const override = overrides[trimmed];
  if (override) {
    const matched = findCaseInsensitive(availableDbs, override);
    if (matched) {
      return {
        project: matched,
        shared: shared.filter((s) => s.toLowerCase() !== matched.toLowerCase()),
        reasoning: `Override '${trimmed}' -> '${matched}' (from MCP_PROJECT_OVERRIDES).`,
      };
    }
  }

  // 2. Try MTM + projectName exact match (case-insensitive)
  const prefixed = findCaseInsensitive(availableDbs, MTM_PREFIX + trimmed);
  if (prefixed) {
    return {
      project: prefixed,
      shared: shared.filter((s) => s.toLowerCase() !== prefixed.toLowerCase()),
      reasoning: `Exact match: '${MTM_PREFIX}${trimmed}' exists.`,
    };
  }

  // 3. Try raw projectName as DB name
  const raw = findCaseInsensitive(availableDbs, trimmed);
  if (raw) {
    return {
      project: raw,
      shared: shared.filter((s) => s.toLowerCase() !== raw.toLowerCase()),
      reasoning: `Exact match: database '${raw}' exists with the project name.`,
    };
  }

  // 4. Fuzzy stem match across MTM-prefixed DBs
  const mtmDbs = availableDbs.filter((d) => d.toUpperCase().startsWith(MTM_PREFIX));
  let best: { db: string; score: number } | null = null;
  for (const db of mtmDbs) {
    const stem = db.slice(MTM_PREFIX.length);
    const score = stemScore(stem, trimmed);
    if (score > 0 && (!best || score > best.score)) {
      best = { db, score };
    }
  }
  if (best) {
    return {
      project: best.db,
      shared: shared.filter((s) => s.toLowerCase() !== best!.db.toLowerCase()),
      reasoning: `Fuzzy match: '${best.db}' shares stem with '${trimmed}' (score ${best.score}).`,
    };
  }

  // 5. No match
  return {
    project: null,
    shared,
    reasoning:
      `No database found for project '${trimmed}'. Tried '${MTM_PREFIX}${trimmed}', ` +
      `raw '${trimmed}', and fuzzy stem matching against MTM-prefixed DBs.`,
  };
};
