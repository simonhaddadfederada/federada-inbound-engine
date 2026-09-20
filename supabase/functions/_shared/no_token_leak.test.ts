// Prueba de higiene: confirma que ningún token real quedó pegado en el
// código fuente versionado (no alcanza con "no lo commiteé a propósito" —
// esto lo verifica de verdad, recorriendo los archivos del repo).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TOKEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "token de Instagram (IGAA...)", pattern: /IGAA[A-Za-z0-9_-]{20,}/ },
  { name: "API key de Anthropic (sk-ant-...)", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "token de Facebook/Meta (EAA...)", pattern: /EAA[A-Za-z0-9]{20,}/ },
];

const SKIP_DIRS = new Set([".git", "node_modules", ".supabase", "supabase/.temp"]);
const SCAN_EXTENSIONS = [".ts", ".html", ".md", ".sql", ".json", ".toml"];

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...(await walk(path)));
    } else if (SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(path);
    }
  }
  return files;
}

Deno.test("ningún token real (Instagram/Anthropic/Meta) quedó en el código fuente versionado", async () => {
  // Raíz del repo: este archivo vive en supabase/functions/_shared/.
  const here = new URL(".", import.meta.url).pathname;
  const repoRoot = `${here}../../..`;

  const files = await walk(repoRoot);
  const offenders: string[] = [];

  for (const file of files) {
    // Este mismo archivo de test menciona los nombres de los tokens a
    // propósito (en los patrones de arriba) — no es un leak real.
    if (file.endsWith("no_token_leak.test.ts")) continue;
    const content = await Deno.readTextFile(file);
    for (const { name, pattern } of TOKEN_PATTERNS) {
      if (pattern.test(content)) {
        offenders.push(`${file.replace(repoRoot, "")}: posible ${name}`);
      }
    }
  }

  assertEquals(offenders, []);
});
