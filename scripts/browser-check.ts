import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { privatePath } from "./normalize.js";
const root = process.env.PREVIEW_URL ?? "http://localhost:3133/FinTracker";
const output = process.env.BROWSER_ARTIFACT_DIR;
if (!output) throw new Error("Set BROWSER_ARTIFACT_DIR outside the repository");
const directory = privatePath(output);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/ledger/", "/assets/", "/accounts/"]) {
      const response = await page.goto(`${root}${path}`);
      if (response?.status() !== 200) throw new Error(`Route failed: ${path}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      if (overflow) throw new Error(`Page overflow at ${width}px: ${path}`);
      if (path === "/" && (width === 1440 || width === 390))
        await page.screenshot({
          path: resolve(join(directory, `preview-${width}.png`)),
          fullPage: true,
        });
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "All four pages passed at 1440, 760, 390, and 320px without page errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
