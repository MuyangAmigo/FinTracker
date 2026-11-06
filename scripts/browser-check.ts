import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, join } from "node:path";
import { privatePath } from "./normalize.js";
let root = process.env.PREVIEW_URL ?? "";
const output = process.env.BROWSER_ARTIFACT_DIR;
if (!output) throw new Error("Set BROWSER_ARTIFACT_DIR outside the repository");
const directory = privatePath(output);
mkdirSync(directory, { recursive: true });
const fixtures = [
  "dashboard",
  "dashboard-empty",
  "dashboard-collapsed",
  "ledger-board",
  "ledger-table",
  "ledger-dialog",
  "assets",
  "assets-empty",
  "accounts",
  "accounts-empty",
] as const;
for (const fixture of fixtures) {
  if (!existsSync(join(directory, `workspace-${fixture}.html`)))
    throw new Error(
      "Missing synthetic workspace fixtures. With BROWSER_ARTIFACT_DIR set, run pnpm exec vitest run components\\finance-app.test.tsx before pnpm test:browser.",
    );
}
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
});
const previewErrors: string[] = [];
const buildRoot = resolve("out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/FinTracker";
const preview = root
  ? null
  : createServer((request, response) => {
      let pathname: string;
      try {
        pathname = decodeURIComponent(
          new URL(request.url ?? "/", "http://127.0.0.1").pathname,
        );
      } catch (error) {
        if (!(error instanceof URIError || error instanceof TypeError)) throw error;
        response.writeHead(400).end("Invalid path");
        return;
      }
      if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const file = resolve(
        buildRoot,
        ...pathname.slice(basePath.length).split("/").filter(Boolean),
      );
      const scope = relative(buildRoot, file);
      if (scope.startsWith("..") || isAbsolute(scope)) {
        response.writeHead(403).end("Outside preview");
        return;
      }
      try {
        const target = statSync(file).isDirectory() ? join(file, "index.html") : file;
        const types: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
          ".woff2": "font/woff2",
          ".txt": "text/plain; charset=utf-8",
          ".json": "application/json",
        };
        const body = readFileSync(target);
        response
          .writeHead(200, {
            "Content-Type": types[extname(target)] ?? "application/octet-stream",
            "Cache-Control": "no-store",
          })
          .end(body);
      } catch (error) {
        const missing =
          error instanceof Error &&
          "code" in error &&
          (error.code === "ENOENT" || error.code === "ENOTDIR");
        if (!missing)
          previewErrors.push(error instanceof Error ? error.message : String(error));
        response
          .writeHead(missing ? 404 : 500)
          .end(missing ? "Not found" : "Preview failed");
      }
    });
try {
  if (preview) {
    if (!existsSync(join(buildRoot, "index.html")))
      throw new Error("Run pnpm build before the browser check");
    await new Promise<void>((resolve, reject) => {
      preview.once("error", reject);
      preview.listen(0, "127.0.0.1", resolve);
    });
    const address = preview.address();
    if (!address || typeof address === "string")
      throw new Error("Preview did not bind to loopback");
    root = `http://127.0.0.1:${address.port}${basePath}`;
  }
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
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "no-preference" });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${root}/`);
      await page.locator(".landing-hero").waitFor();
      await page.screenshot({
        path: resolve(join(directory, `presentation-${colorScheme}-${width}.png`)),
        fullPage: true,
        animations: "disabled",
      });
    }
    const styles = await page.evaluate((scheme) => {
      const fixture = document.createElement("section");
      fixture.id = "presentation-check";
      fixture.innerHTML = `
        <div class="panel"><div class="metric">
          <input aria-label="Synthetic focus check" value="123.45" />
          <select aria-label="Synthetic select check"><option>2024</option></select>
          <h2>Heading</h2><strong>Strong</strong><p>Body</p>
        </div></div>
        <details class="panel references">
          <summary>Synthetic reference focus check</summary>
          <div class="disclosure-content"><p>Reference content</p></div>
        </details>
        <details class="chart-data">
          <summary>Synthetic disclosure check</summary>
          <div class="disclosure-content"><div class="table-scroll">
            <p style="height:120px">Synthetic content</p><button>Inner control</button>
          </div></div>
        </details><button id="after-disclosure">After disclosure</button>`;
      document.body.append(fixture);
      const input = fixture.querySelector("input")!;
      const select = fixture.querySelector("select")!;
      const border = getComputedStyle(input).borderColor;
      input.focus();
      const inputStyle = getComputedStyle(input);
      const focusedBorder = inputStyle.borderColor;
      const inputOutline = inputStyle.outlineStyle;
      select.focus();
      const weights = [
        document.body,
        fixture.querySelector("h2")!,
        fixture.querySelector("strong")!,
        document.querySelector(".brand")!,
      ].map((element) => getComputedStyle(element).fontWeight);
      const icon = document.querySelector(".ui-icon")!;
      const iconStyle = getComputedStyle(icon);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const lightness = scheme === "dark" ? [18, 20, 22, 24] : [96, 97, 98, 99];
      return {
        border,
        focusedBorder,
        inputOutline,
        selectOutline: getComputedStyle(select).outlineStyle,
        weights,
        numeric: inputStyle.fontVariantNumeric,
        wrap: getComputedStyle(fixture.querySelector("p")!).textWrapStyle,
        iconOffset: parseFloat(iconStyle.top) / parseFloat(iconStyle.fontSize),
        surfaces: lightness.map((value, level) =>
          [
            getComputedStyle(document.documentElement)
              .getPropertyValue(`--surface-${level}`)
              .trim(),
            `oklch(${value}% 0.006 150)`,
          ].map((color) => {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data);
          }),
        ),
        focusColors: ["--focus-inner", ...lightness.map((_, i) => `--surface-${i}`)].map(
          (token) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = getComputedStyle(document.documentElement)
              .getPropertyValue(token)
              .trim();
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data);
          },
        ),
      };
    }, colorScheme);
    const expectedWeights =
      colorScheme === "dark"
        ? ["360", "610", "660", "710"]
        : ["400", "650", "700", "750"];
    if (JSON.stringify(styles.weights) !== JSON.stringify(expectedWeights))
      throw new Error(`Incorrect ${colorScheme} weights: ${styles.weights.join(", ")}`);
    if (
      styles.surfaces.some(([actual, expected]) =>
        actual.some((channel, index) => Math.abs(channel - expected[index]) > 1),
      )
    )
      throw new Error(
        `Incorrect ${colorScheme} surface lightness: ${JSON.stringify(styles.surfaces)}`,
      );
    if (
      styles.inputOutline !== "none" ||
      styles.selectOutline !== "none" ||
      styles.border !== styles.focusedBorder
    )
      throw new Error(`Input focus must use shadows, not an outline or border change`);
    const luminances = styles.focusColors.map(([r, g, b, alpha]) => {
      if (alpha !== 255) throw new Error("The inner focus ring must be opaque");
      const linear = [r, g, b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    });
    for (const surface of luminances.slice(1)) {
      const contrast =
        (Math.max(luminances[0], surface) + 0.05) /
        (Math.min(luminances[0], surface) + 0.05);
      if (contrast < 3)
        throw new Error(`${colorScheme} focus contrast ${contrast} is below 3:1`);
    }
    if (
      styles.numeric !== "tabular-nums" ||
      styles.wrap !== "pretty" ||
      Math.abs(styles.iconOffset - 0.125) > 0.001
    )
      throw new Error(`Incorrect presentation styles: ${JSON.stringify(styles)}`);
    for (const control of ["input", "select"]) {
      await page.locator(`#presentation-check ${control}`).focus();
      await page.waitForFunction((selector) => {
        const shadow = getComputedStyle(document.querySelector(selector)!).boxShadow;
        return shadow.includes("0px 0px 0px 2px") && shadow.includes("0px 0px 0px 5px");
      }, `#presentation-check ${control}`);
    }
    const reference = page.locator("#presentation-check .references summary");
    await reference.focus();
    const referenceFocus = await reference.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
        offset: parseFloat(style.outlineOffset),
      };
    });
    if (
      referenceFocus.style !== "solid" ||
      referenceFocus.width < 2 ||
      referenceFocus.offset > -referenceFocus.width
    )
      throw new Error("The reference summary focus ring must stay inside its panel");
    const summary = page.locator("#presentation-check .chart-data summary");
    const content = page.locator("#presentation-check .chart-data .disclosure-content");
    if ((await content.boundingBox())!.height !== 0)
      throw new Error("Closed disclosure must have zero height");
    await summary.focus();
    await page.keyboard.press("Tab");
    if (
      !(await page
        .locator("#after-disclosure")
        .evaluate((el) => el === document.activeElement))
    )
      throw new Error("Closed disclosure must not expose focusable descendants");
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#presentation-check .chart-data .disclosure-content")!
          .getBoundingClientRect().height >= 120,
    );
    await page.keyboard.press("Tab");
    if (
      !(await content.getByRole("button").evaluate((el) => el === document.activeElement))
    )
      throw new Error("Open disclosure must expose its controls");
    // Sample before the closing transition finishes, not just its end state.
    await page.waitForTimeout(250);
    const collapse = await content.evaluate(async (element) => {
      const start = element.getBoundingClientRect().height;
      element.closest("details")!.querySelector("summary")!.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { start, during: element.getBoundingClientRect().height };
    });
    if (!(collapse.during > 0 && collapse.during < collapse.start))
      throw new Error(`Disclosure did not animate closed: ${JSON.stringify(collapse)}`);
    await page.waitForFunction(
      () =>
        document
          .querySelector("#presentation-check .chart-data .disclosure-content")!
          .getBoundingClientRect().height === 0,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await summary.click();
    const reduced = await page
      .locator("#presentation-check .chart-data")
      .evaluate(
        (element) => getComputedStyle(element, "::details-content").transitionDuration,
      );
    if (reduced !== "0s")
      throw new Error("Reduced motion must disable disclosure transitions");
    await page.emulateMedia({ forcedColors: "active" });
    for (const control of ["input", "select"]) {
      const field = page.locator(`#presentation-check ${control}`);
      await field.focus();
      const forcedFocus = await field.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "Highlight";
        document.body.append(probe);
        const highlight = getComputedStyle(probe).color;
        probe.remove();
        const style = getComputedStyle(element);
        return {
          shadow: style.boxShadow,
          outline: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          color: style.outlineColor,
          highlight,
        };
      });
      if (
        forcedFocus.shadow !== "none" ||
        forcedFocus.outline !== "solid" ||
        forcedFocus.width < 2 ||
        forcedFocus.color !== forcedFocus.highlight
      )
        throw new Error(`Missing system-colored focus for ${control} in High Contrast`);
    }
    await page.emulateMedia({ forcedColors: "none" });
    await page.locator("#presentation-check").evaluate((element) => element.remove());
  }
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  if (!stylesheets.length) throw new Error("The preview has no production stylesheet");
  const workspace = await browser.newPage();
  workspace.on("pageerror", (error) => errors.push(error.message));
  const issues: string[] = [];
  const renderWorkspace = async (fixture: (typeof fixtures)[number]) => {
    const base = `${root}/`.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    await workspace.setContent(
      readFileSync(join(directory, `workspace-${fixture}.html`), "utf8").replace(
        "<head>",
        `<head><base href="${base}">`,
      ),
    );
    await workspace.evaluate(() => {
      for (const image of document.querySelectorAll<HTMLImageElement>(".profile-avatar"))
        image.loading = "eager";
      for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
        dialog.removeAttribute("open");
        dialog.showModal();
      }
    });
    for (const url of stylesheets) await workspace.addStyleTag({ url });
    await workspace.waitForFunction(
      () =>
        [...document.querySelectorAll<HTMLImageElement>(".profile-avatar")].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      undefined,
      { timeout: 5000 },
    );
    await workspace.evaluate(() => window.scrollTo(0, 0));
  };
  for (const colorScheme of ["light", "dark"] as const) {
    await workspace.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1280, height: 800 },
      { width: 1024, height: 1000 },
      { width: 390, height: 1000 },
      { width: 320, height: 1000 },
    ]) {
      await workspace.setViewportSize(viewport);
      for (const fixture of fixtures) {
        await renderWorkspace(fixture);
        const label = `${fixture}, ${colorScheme}, ${viewport.width}px`;
        const found = await workspace.evaluate(
          ({ name, width }) => {
            const result: string[] = [];
            const shell = document.querySelector<HTMLElement>(".finance-shell")!;
            if (document.documentElement.scrollWidth > width + 1)
              result.push("Workspace overflows the viewport");
            if (name.startsWith("dashboard") && width >= 1280) {
              const hero = document
                .querySelector<HTMLElement>(".hero-chart")!
                .getBoundingClientRect();
              const main = document.querySelector<HTMLElement>(".finance-main")!;
              const style = getComputedStyle(main);
              const contentWidth =
                main.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight);
              const contentTop =
                main.getBoundingClientRect().top + parseFloat(style.paddingTop);
              const visibleHeight = Math.max(
                0,
                Math.min(hero.bottom, innerHeight) - Math.max(hero.top, contentTop),
              );
              const share =
                (hero.width * visibleHeight) /
                (contentWidth * (innerHeight - contentTop));
              if (share <= 0.5)
                result.push(
                  `Hero covers only ${(share * 100).toFixed(1)}% of first-screen content`,
                );
              if (
                [...document.querySelectorAll(".hero-chart .chart-column > span")].some(
                  (label) => label.getBoundingClientRect().bottom > innerHeight,
                )
              )
                result.push("Chart month labels fall below the first screen");
            }
            if (name.startsWith("assets")) {
              const bands = [...document.querySelectorAll(".asset-bands > .asset-band")];
              if (bands.length !== 3) result.push("Expected three asset bands");
              for (let index = 1; index < bands.length; index++) {
                const gap =
                  bands[index].getBoundingClientRect().top -
                  bands[index - 1].getBoundingClientRect().bottom;
                if (Math.abs(gap - 48) > 1) result.push(`Asset band gap is ${gap}px`);
              }
              for (const cell of document.querySelectorAll(
                "th:not(:first-child), td:not(:first-child)",
              )) {
                if (getComputedStyle(cell).whiteSpace !== "nowrap")
                  result.push(
                    "Asset table cells must stay readable and scroll instead of wrapping vertically",
                  );
              }
            }
            if (name === "ledger-board") {
              if (document.querySelectorAll(".month-card").length !== 12)
                result.push("Monthly board must contain twelve cards");
              const counts = [
                ...document.querySelectorAll(".month-column-heading .section-count"),
              ].reduce((sum, element) => sum + Number(element.textContent), 0);
              if (counts !== 12) result.push("Monthly column counts do not total twelve");
            }
            if (name.startsWith("accounts")) {
              const position = getComputedStyle(
                document.querySelector(".account-actions")!,
              ).position;
              if (position !== (width > 1150 ? "sticky" : "static"))
                result.push(`Wrong action-rail position: ${position}`);
            }
            const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
            if (dialog) {
              const box = dialog.getBoundingClientRect();
              if (
                box.left < 0 ||
                box.right > width ||
                box.top < 0 ||
                box.bottom > innerHeight
              )
                result.push("Monthly dialog exceeds the viewport");
            }
            for (const button of shell.querySelectorAll<HTMLButtonElement>("button")) {
              if (!button.getClientRects().length || button.disabled) continue;
              if (button.getBoundingClientRect().height < 43)
                result.push(
                  `Small action target: ${button.getAttribute("aria-label") ?? button.textContent?.trim()}`,
                );
            }

            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            const backgrounds = new Map<Element, number[]>();
            const colors = {
              pixels(color: string) {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                return [...context.getImageData(0, 0, 1, 1).data];
              },
              background(element: Element | null): number[] {
                if (!element) return [255, 255, 255];
                const cached = backgrounds.get(element);
                if (cached) return cached;
                const own = colors.pixels(getComputedStyle(element).backgroundColor);
                const below = colors.background(element.parentElement);
                const alpha = own[3] / 255;
                const value = below.map(
                  (channel, index) => own[index] * alpha + channel * (1 - alpha),
                );
                backgrounds.set(element, value);
                return value;
              },
              luminance(color: number[]) {
                const linear = color.slice(0, 3).map((channel) => {
                  const value = channel / 255;
                  return value <= 0.04045
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4;
                });
                return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
              },
              contrast(foreground: number[], backdrop: number[]) {
                const a = colors.luminance(foreground),
                  b = colors.luminance(backdrop);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              },
            };
            const checked = new Set<string>();
            const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
              const element = node.parentElement;
              const text = node.textContent?.trim();
              if (
                element &&
                text &&
                element.getClientRects().length &&
                !element.closest("button:disabled, input:disabled")
              ) {
                const details = element.closest("details");
                const hiddenDisclosure =
                  details && !details.open && !element.closest("summary");
                const style = getComputedStyle(element);
                if (
                  !hiddenDisclosure &&
                  style.visibility !== "hidden" &&
                  style.display !== "none"
                ) {
                  const key = `${style.color}:${colors.background(element).join(",")}:${style.fontSize}:${style.fontWeight}`;
                  if (!checked.has(key)) {
                    checked.add(key);
                    const large =
                      parseFloat(style.fontSize) >= 24 ||
                      (parseFloat(style.fontSize) >= 18.66 &&
                        Number(style.fontWeight) >= 700);
                    const ratio = colors.contrast(
                      colors.pixels(style.color),
                      colors.background(element),
                    );
                    if (ratio + 0.01 < (large ? 3 : 4.5))
                      result.push(
                        `Low text contrast ${ratio.toFixed(2)}: ${text.slice(0, 40)}`,
                      );
                  }
                }
              }
              node = walker.nextNode();
            }
            const tokens = getComputedStyle(shell);
            const focus = colors.pixels(tokens.getPropertyValue("--focus-inner").trim());
            for (let level = 0; level < 4; level++) {
              if (
                colors.contrast(
                  focus,
                  colors.pixels(tokens.getPropertyValue(`--surface-${level}`).trim()),
                ) < 3
              )
                result.push(`Focus contrast is below 3:1 on surface ${level}`);
            }
            return result;
          },
          { name: fixture, width: viewport.width },
        );
        issues.push(...found.map((issue) => `${label}: ${issue}`));
        if (fixture === "accounts" && viewport.width >= 1280) {
          await workspace.evaluate(() => window.scrollTo(0, 240));
          const before = await workspace.locator(".account-actions").boundingBox();
          const mainBefore = await workspace.locator(".accounts-main").boundingBox();
          await workspace.evaluate(() => window.scrollTo(0, 440));
          const after = await workspace.locator(".account-actions").boundingBox();
          const mainAfter = await workspace.locator(".accounts-main").boundingBox();
          if (
            !before ||
            !after ||
            !mainBefore ||
            !mainAfter ||
            Math.abs(before.y - after.y) > 1 ||
            mainBefore.y - mainAfter.y < 190
          )
            issues.push(
              `${label}: Action rail does not stay in place while the main area scrolls`,
            );
          await workspace.evaluate(() => window.scrollTo(0, 0));
        }
        if (
          (viewport.width === 1440 || viewport.width === 390) &&
          ["dashboard", "ledger-board", "assets", "accounts"].includes(fixture)
        ) {
          await workspace.screenshot({
            path: join(
              directory,
              `workspace-${fixture}-${colorScheme}-${viewport.width}.png`,
            ),
            animations: "disabled",
          });
        }
        if (fixture === "ledger-board" && viewport.width === 390) {
          const board = workspace.getByRole("region", {
            name: "2024 年月度状态看板，可横向滚动",
          });
          await board.focus();
          await workspace.keyboard.press("ArrowRight");
          await workspace.waitForFunction(
            () => document.querySelector(".board-scroll")!.scrollLeft > 0,
          );
        }
      }
    }
    await renderWorkspace("ledger-dialog");
    const field = workspace.getByLabel("Salary 金额");
    const border = await field.evaluate(
      (element) => getComputedStyle(element).borderColor,
    );
    await field.focus();
    const focused = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        border: style.borderColor,
        outline: style.outlineStyle,
        shadow: style.boxShadow,
      };
    });
    if (
      focused.border !== border ||
      focused.outline !== "none" ||
      !focused.shadow.includes("0px 0px 0px 2px")
    )
      issues.push(
        `${colorScheme}: Authenticated inputs do not retain their border and double focus ring`,
      );
    await workspace.emulateMedia({ forcedColors: "active" });
    await field.focus();
    const highContrast = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        style.outlineStyle === "solid" &&
        parseFloat(style.outlineWidth) >= 2 &&
        style.boxShadow === "none"
      );
    });
    if (!highContrast)
      issues.push(`${colorScheme}: Missing authenticated High Contrast focus`);
    await workspace.emulateMedia({ forcedColors: "none" });
  }
  await workspace.close();
  if (issues.length || errors.length || previewErrors.length)
    throw new Error([...issues, ...errors, ...previewErrors].join("\n"));
  console.log(
    "Guest and synthetic signed-in layouts passed at desktop, tablet, and mobile sizes. Hero dominance, 48px bands, sticky rails, monthly counts, contrast, action targets, dialog bounds, keyboard scrolling, light/dark themes, native disclosures, High Contrast focus, and reduced motion passed without page errors.",
  );
} finally {
  await browser.close();
  if (preview?.listening)
    await new Promise<void>((resolve, reject) => {
      preview.close((error) => (error ? reject(error) : resolve()));
    });
}
