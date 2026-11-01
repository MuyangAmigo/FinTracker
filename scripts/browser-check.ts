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
  for (const { width, height } of [
    { width: 1440, height: 1000 },
    { width: 1389, height: 1305 },
    { width: 1024, height: 1000 },
    { width: 893, height: 1000 },
    { width: 760, height: 1000 },
    { width: 390, height: 1000 },
    { width: 390, height: 1600 },
    { width: 320, height: 1000 },
  ]) {
    await page.setViewportSize({ width, height });
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
      const layoutError = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".landing-main")!;
        const hero = document.querySelector<HTMLElement>(".landing-hero")!;
        const features = document.querySelector<HTMLElement>(".landing-features")!;
        const setup = document.querySelector<HTMLElement>(".landing-setup");
        const mainBox = main.getBoundingClientRect();
        const featuresBox = features.getBoundingClientRect();
        const contentBottom = (setup ?? features).getBoundingClientRect().bottom;
        const paddingBottom = parseFloat(getComputedStyle(main).paddingBottom);
        if (Math.abs(mainBox.bottom - contentBottom - paddingBottom) > 1)
          return "Feature row and setup notice are not at the page bottom";
        if (mainBox.bottom < window.innerHeight - 1)
          return "Landing page does not fill the viewport";
        if (featuresBox.top < hero.getBoundingClientRect().bottom - 1)
          return "Feature row overlaps the hero";
        for (const feature of features.querySelectorAll(".landing-feature")) {
          const top = feature.querySelector(".landing-feature-top")!;
          const number = top.querySelector("span")!.getBoundingClientRect();
          const icon = top.querySelector("svg")!.getBoundingClientRect();
          if (
            Math.abs(number.left - top.getBoundingClientRect().left) > 1 ||
            number.right > icon.left
          )
            return "Feature number is not left-aligned before its icon";
        }
        return null;
      });
      if (layoutError) throw new Error(`${layoutError} at ${width}x${height}: ${path}`);
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
      if (
        path === "/" &&
        (width === 1440 || width === 1389 || (width === 390 && height === 1000))
      )
        await page.screenshot({
          path: resolve(join(directory, `preview-${width}.png`)),
          fullPage: true,
          animations: "disabled",
        });
    }
    const dialogBox = await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      dialog.className = "modal modal-wide";
      dialog.textContent = "Synthetic monthly dialog layout check";
      document.body.append(dialog);
      try {
        dialog.showModal();
        const box = dialog.getBoundingClientRect();
        return { width: box.width, left: box.left, right: box.right };
      } finally {
        dialog.close();
        dialog.remove();
      }
    });
    const expectedDialogWidth = Math.min(1040, width - 32);
    if (
      Math.abs(dialogBox.width - expectedDialogWidth) > 1 ||
      dialogBox.left < 0 ||
      dialogBox.right > width
    )
      throw new Error(
        `Wide monthly dialog has incorrect bounds at ${width}px: ${JSON.stringify(dialogBox)}`,
      );
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Signed-out landing, bottom feature layout, left-aligned numbers, profile login, and wide-dialog bounds passed at desktop and mobile sizes without page errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
