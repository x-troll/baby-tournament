// Rules content pipeline: content/rules/*.md -> validated, sanitized,
// server-rendered HTML. Node-only (fs/path/process.cwd()) — never import
// this from a client component. Markdown is rendered exclusively here, so
// there is no client-side markdown bundle anywhere in the app.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import rehypeSanitize from "rehype-sanitize";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { z } from "zod";
import { Game } from "@/generated/prisma/enums";

const CONTENT_DIR = path.join(process.cwd(), "content", "rules");
const PUBLIC_DIR = path.join(process.cwd(), "public");

const GAME_SLUGS: Record<Game, string> = {
  [Game.MARIO_KART]: "mario-kart",
  [Game.SUPER_SMASH]: "super-smash",
};

export function rulesFilePath(game: Game): string {
  return path.join(CONTENT_DIR, `${GAME_SLUGS[game]}.md`);
}

const ScreenshotSchema = z.object({
  src: z.string().min(1, "screenshot src is required"),
  caption: z.string().min(1, "screenshot caption is required"),
});

const RulesFrontmatterSchema = z.object({
  game: z.enum(Object.values(Game) as [Game, ...Game[]]),
  summary: z.string().min(1, "summary is required"),
  screenshots: z.array(ScreenshotSchema).default([]),
});

export type RulesFrontmatter = z.infer<typeof RulesFrontmatterSchema>;

export interface ParsedRules extends RulesFrontmatter {
  /** Sanitized HTML, rendered server-side — never send raw markdown to the client. */
  bodyHtml: string;
}

export interface RulesValidationResult {
  game: Game;
  filePath: string;
  errors: string[];
}

/**
 * Checks a screenshot's `src` (a public-root-relative path, e.g.
 * "/rules/mario-kart/foo.png") actually exists on disk under public/.
 */
function checkScreenshotsExist(screenshots: RulesFrontmatter["screenshots"], filePath: string): string[] {
  const errors: string[] = [];
  for (const shot of screenshots) {
    if (!shot.src.startsWith("/")) {
      errors.push(`${filePath}: screenshot src "${shot.src}" must be a root-relative path (start with "/")`);
      continue;
    }
    const onDisk = path.join(PUBLIC_DIR, shot.src);
    if (!fs.existsSync(/* turbopackIgnore: true */ onDisk)) {
      errors.push(`${filePath}: screenshot "${shot.src}" (caption: "${shot.caption}") does not exist at ${onDisk}`);
    }
  }
  return errors;
}

/**
 * Validates one game's rules file, collecting every problem found rather
 * than stopping at the first — used by the build-time check (Phase 3
 * requirement: fail the build if a game is missing a rules file, a
 * `summary`, or references a screenshot that doesn't exist).
 */
export function validateRulesFileSync(game: Game): RulesValidationResult {
  const filePath = rulesFilePath(game);

  // Turbopack's build-time tracer can't follow the enum-keyed lookup in
  // rulesFilePath() and falls back to tracing the whole project, which
  // only matters for `output: "standalone"` builds (we deploy to Heroku
  // as a normal `next start` on the full slug, not a pruned standalone
  // bundle) — safe to ignore: content/rules/*.md is always committed and
  // always present regardless of what gets traced.
  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) {
    return { game, filePath, errors: [`Missing rules file for ${game}: expected ${filePath}`] };
  }

  const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8");
  const { data } = matter(raw);
  const parsed = RulesFrontmatterSchema.safeParse(data);

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${filePath}: ${issue.path.length ? issue.path.join(".") : "(frontmatter)"}: ${issue.message}`,
    );
    return { game, filePath, errors };
  }

  const errors: string[] = [];
  if (parsed.data.game !== game) {
    errors.push(
      `${filePath}: frontmatter "game: ${parsed.data.game}" does not match the file's expected game ${game} — check the filename-to-game mapping in rules-content.ts`,
    );
  }
  errors.push(...checkScreenshotsExist(parsed.data.screenshots, filePath));

  return { game, filePath, errors };
}

export function validateAllRulesFiles(): RulesValidationResult[] {
  return Object.values(Game).map((game) => validateRulesFileSync(game));
}

async function renderMarkdownToSafeHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize) // defense in depth even though content is admin-authored
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

/**
 * Loads, validates, and renders one game's rules file for use in a Server
 * Component. Throws with every collected problem if validation fails —
 * pages should let this throw during rendering/build rather than
 * swallowing it, so a broken rules file surfaces loudly instead of
 * silently showing blank rules at the bar.
 */
export async function loadRules(game: Game): Promise<ParsedRules> {
  const result = validateRulesFileSync(game);
  if (result.errors.length > 0) {
    throw new Error(`Invalid rules content for ${game}:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  const raw = fs.readFileSync(/* turbopackIgnore: true */ result.filePath, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = RulesFrontmatterSchema.parse(data);
  const bodyHtml = await renderMarkdownToSafeHtml(content);

  return { ...frontmatter, bodyHtml };
}

export async function loadAllRules(): Promise<Record<Game, ParsedRules>> {
  const entries = await Promise.all(
    Object.values(Game).map(async (game) => [game, await loadRules(game)] as const),
  );
  return Object.fromEntries(entries) as Record<Game, ParsedRules>;
}
