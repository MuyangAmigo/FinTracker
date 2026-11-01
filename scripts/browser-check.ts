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
  for (const width of [1440, 1024, 893, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/ledger/", "/assets/", "/accounts/"]) {
      const response = await page.goto(`${root}${path}`);
      if (response?.status() !== 200) throw new Error(`Route failed: ${path}`);
      await page
        .getByRole("heading", { level: 1 })
        .waitFor()
        .catch((error: unknown) => {
          throw new Error(
            `Landing did not render at ${width}px: ${path}. Browser errors: ${errors.join("; ") || "none"}`,
            { cause: error },
          );
        });
      await page.locator(".landing-hero").waitFor();
      const login = page.getByRole("banner").getByRole("button", {
        name: "Microsoft 登录",
      });
      await login.waitFor();
      if ((await page.getByRole("button", { name: "Microsoft 登录" }).count()) !== 1)
        throw new Error(`Expected one header login: ${path}`);
      if ((await page.locator(".landing-feature").count()) !== 3)
        throw new Error(`Missing landing features: ${path}`);
      if (
        await page
          .locator(
            ".sidebar, .metrics, .filter-bar, .setup-banner, .sidebar-note, .sidebar-bottom, footer",
          )
          .count()
      )
        throw new Error(`Signed-out page contains workspace UI: ${path}`);
      const loginBox = await login.boundingBox();
      const brandBox = await page
        .getByRole("link", { name: "FinTracker 首页" })
        .boundingBox();
      if (
        !loginBox ||
        !brandBox ||
        brandBox.x < loginBox.x + loginBox.width ||
        brandBox.x - loginBox.x - loginBox.width > 20
      )
        throw new Error(`Login is not beside the brand at ${width}px`);
      if (loginBox.width !== 44 || loginBox.height !== 44)
        throw new Error(`Profile login must have a 44px touch target at ${width}px`);
      if ((await login.textContent()) !== "")
        throw new Error(`Profile login must be icon-only: ${path}`);
      const avatar = login.locator("img.profile-avatar");
      if (
        !(await avatar.isVisible()) ||
        !(await avatar.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ))
      )
        throw new Error(`Personal avatar is not visible at ${width}px: ${path}`);
      if (
        (await page.locator(".landing-access, .landing-explore").count()) ||
        (await page
          .getByText("右上角使用 Microsoft 账户登录，仅限获准的家庭成员。")
          .count()) ||
        (await page.getByRole("link", { name: "从这里，了解我们的账本" }).count())
      )
        throw new Error(`Removed landing content is still present: ${path}`);
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
    "Signed-out landing, profile login, and removed landing/workspace UI passed on all four routes at 1440, 1024, 893, 760, 390, and 320px without page errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
