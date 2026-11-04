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
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Landing layout and dialog bounds passed at desktop and mobile sizes. Light/dark surfaces, font weights, double focus rings with at least 3:1 contrast, unclipped reference focus, Windows High Contrast focus, icon alignment, tabular figures, pretty wrapping, disclosure animation and keyboard access, and reduced motion passed without page errors.",
  );
} finally {
  await browser.close();
}
