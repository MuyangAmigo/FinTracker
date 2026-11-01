// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render as renderView,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { FinanceApp } from "./finance-app";
import { FinanceProvider } from "./finance-session";
import { ApiError, publicConfig } from "../lib/client";
import type { Store } from "../shared/finance";
import { monthInput, balanceInput, parseMoney } from "../shared/finance";

const mocks = vi.hoisted(() => ({
  configured: true,
  request: vi.fn(),
  createAuth: vi.fn(),
  getAllAccounts: vi.fn(),
  loginRedirect: vi.fn(),
}));
vi.mock("../lib/client", async () => {
  const actual = await vi.importActual<typeof import("../lib/client")>("../lib/client");
  return {
    ...actual,
    get configured() {
      return mocks.configured;
    },
    request: mocks.request,
    createAuth: () => mocks.createAuth(),
  };
});
let store: Store;
function render(ui: ReactElement) {
  return renderView(ui, { wrapper: FinanceProvider });
}
async function editMonth(month = "2024-01") {
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText("记录年份"), {
    target: { value: month.slice(0, 4) },
  });
  fireEvent.click(screen.getByRole("button", { name: `编辑 ${month}` }));
  return screen.findByLabelText("Salary 金额");
}
beforeEach(() => {
  mocks.configured = true;
  mocks.getAllAccounts.mockReturnValue([{ username: "synthetic" }]);
  mocks.loginRedirect.mockResolvedValue(undefined);
  store = {
    people: [
      { id: "a", name: "Person A" },
      { id: "b", name: "Person B" },
    ],
    accounts: [
      {
        id: "bank",
        name: "Bank A",
        type: "BANK",
        ownerId: "a",
        assetEnabled: true,
        expenseEnabled: false,
        archived: false,
        version: 0,
      },
      {
        id: "other",
        name: "Bank B",
        type: "BANK",
        ownerId: "b",
        assetEnabled: true,
        expenseEnabled: false,
        archived: false,
        version: 0,
      },
    ],
    lines: [
      {
        id: "salary",
        name: "Salary",
        kind: "INCOME",
        ownerId: "a",
        accountId: null,
        archived: false,
      },
    ],
    periods: [
      { month: "2024-01", incomeComplete: true, expenseComplete: true, version: 0 },
    ],
    entries: [
      {
        id: "entry",
        lineId: "salary",
        month: "2024-01",
        ownerId: null,
        amountMinor: "10000",
        note: "",
      },
    ],
    balances: [
      {
        id: "balance",
        accountId: "bank",
        asOf: "2024-01-31",
        ownerId: null,
        amountMinor: "10000",
        precision: "MONTH",
        note: "",
        version: 0,
      },
    ],
    references: [],
  };
  mocks.createAuth.mockReturnValue({
    initialize: async () => {},
    handleRedirectPromise: async () => null,
    getAllAccounts: mocks.getAllAccounts,
    setActiveAccount: () => {},
    logoutRedirect: async () => {},
    loginRedirect: mocks.loginRedirect,
  });
  mocks.request.mockImplementation(
    async (_auth, path: string, method: string = "GET", body?: unknown) => {
      if (path === "bootstrap") return new Response(JSON.stringify(store));
      if (method === "PUT" && path.startsWith("months/")) {
        const parsed = monthInput.parse(body);
        store.periods[0].version++;
        if (parsed.entries[0].amount !== null)
          store.entries[0].amountMinor = parseMoney(parsed.entries[0].amount).toString();
      }
      return new Response(JSON.stringify({ saved: true }));
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
describe("household interface", () => {
  it("keeps collapsed navigation across finance routes", async () => {
    const view = render(<FinanceApp key="dashboard" page="dashboard" />);
    fireEvent.click(await screen.findByRole("button", { name: "收起导航栏" }));
    view.rerender(<FinanceApp key="ledger" page="ledger" />);
    expect(
      screen.getByRole("button", { name: "展开导航栏" }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByRole("link", { name: "FinTracker 首页" })).toBeNull();
    expect(screen.getByRole("link", { name: "月度记账" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "展开导航栏" }));
    expect(screen.getByRole("link", { name: "FinTracker 首页" })).toBeTruthy();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("shows independent income and spending completeness in the monthly table", async () => {
    store.periods[0].expenseComplete = false;
    render(<FinanceApp page="ledger" />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("记录年份"), { target: { value: "2024" } });
    const row = screen.getByRole("button", { name: "查看 2024-01" }).closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells[5].textContent).toBe("完整");
    expect(cells[6].textContent).toBe("未完成");
  });
  it("reuses the authenticated store when navigating between finance pages", async () => {
    const view = render(<FinanceApp key="dashboard" page="dashboard" />);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    view.rerender(<FinanceApp key="ledger" page="ledger" />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByLabelText("Salary 金额")).toBeNull();
    view.rerender(<FinanceApp key="assets" page="assets" />);
    expect(screen.getAllByText("Bank A").length).toBeGreaterThan(0);
    expect(mocks.createAuth).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("正在安全加载记录…")).toBeNull();
  });
  it("initializes and loads only once under Strict Mode", async () => {
    renderView(
      <StrictMode>
        <FinanceProvider>
          <FinanceApp page="ledger" />
        </FinanceProvider>
      </StrictMode>,
    );
    await editMonth();
    expect(mocks.createAuth).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("revalidates records older than a minute when entering another route", async () => {
    const now = Date.now();
    const view = render(<FinanceApp key="dashboard" page="dashboard" />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    view.rerender(<FinanceApp key="ledger" page="ledger" />);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.createAuth).toHaveBeenCalledTimes(1);
  });
  it.each([new Error("网络连接失败"), new ApiError(503, "服务暂时不可用")])(
    "retries stale records on the next route after %s",
    async (failure) => {
      const now = Date.now();
      const view = render(<FinanceApp key="dashboard" page="dashboard" />);
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
      vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
      mocks.request.mockRejectedValueOnce(failure);
      view.rerender(<FinanceApp key="ledger" page="ledger" />);
      expect((await screen.findByRole("alert")).textContent).toContain(failure.message);
      expect(screen.queryByLabelText("Salary 金额")).toBeNull();
      expect(mocks.request).toHaveBeenCalledTimes(2);

      view.rerender(<FinanceApp key="assets" page="assets" />);
      await screen.findAllByText("Bank A");
      expect(mocks.request).toHaveBeenCalledTimes(3);
      expect(screen.queryByRole("alert")).toBeNull();
      view.rerender(<FinanceApp key="ledger-again" page="ledger" />);
      expect(screen.getByRole("table")).toBeTruthy();
      expect(mocks.request).toHaveBeenCalledTimes(3);
    },
  );
  it("does not restore records from a pending load after signing out", async () => {
    let finishLoad: (response: Response) => void = () => {};
    mocks.request.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishLoad = resolve;
      }),
    );
    render(<FinanceApp page="ledger" />);
    fireEvent.click(await screen.findByRole("button", { name: "退出登录" }));
    await act(async () => finishLoad(new Response(JSON.stringify(store))));
    expect(screen.queryByLabelText("Salary 金额")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
  it("clears financial records before signing out", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(screen.queryByLabelText("Salary 金额")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("button", { name: "Microsoft 登录" })).toBeTruthy();
  });
  it("removes cached records if access is revoked during a refresh", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    mocks.request.mockRejectedValueOnce(new Error("服务暂时不可用"));
    fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
    await screen.findAllByRole("alert");
    mocks.request.mockRejectedValueOnce(new ApiError(403, "访问权限已撤销"));
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(screen.queryByLabelText("Salary 金额")).toBeNull());
    expect(screen.getByRole("alert").textContent).toContain("访问权限已撤销");
  });
  it.each([401, 403])(
    "clears cached records and invalidates pending loads when a save returns %s",
    async (status) => {
      const view = render(<FinanceApp key="ledger" page="ledger" />);
      await editMonth();
      mocks.request.mockRejectedValueOnce(new Error("服务暂时不可用"));
      fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
      await screen.findByRole("button", { name: "重新加载" });

      const oldResponse = JSON.stringify(store);
      let finishLoad: (response: Response) => void = () => {};
      mocks.request.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishLoad = resolve;
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
      mocks.request.mockRejectedValueOnce(new ApiError(status, "访问权限已撤销"));
      fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
      await waitFor(() => expect(screen.queryByLabelText("Salary 金额")).toBeNull());
      expect(screen.getByRole("alert").textContent).toContain("访问权限已撤销");

      await act(async () => finishLoad(new Response(oldResponse)));
      expect(screen.queryByLabelText("Salary 金额")).toBeNull();
      const calls = mocks.request.mock.calls.length;
      view.rerender(<FinanceApp key="assets" page="assets" />);
      expect(screen.queryByText("Bank A")).toBeNull();
      expect(mocks.request).toHaveBeenCalledTimes(calls);
    },
  );
  it.each(
    [401, 403].flatMap((status) =>
      ["导出月度收支", "导出资产历史", "完整数据备份"].map((button) => ({
        status,
        button,
      })),
    ),
  )("clears cached records when $button returns $status", async ({ status, button }) => {
    const view = render(<FinanceApp key="ledger" page="ledger" />);
    await editMonth();
    mocks.request.mockRejectedValueOnce(new ApiError(status, "访问权限已撤销"));
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() => expect(screen.queryByLabelText("Salary 金额")).toBeNull());
    expect(screen.getByRole("alert").textContent).toContain("访问权限已撤销");
    view.rerender(<FinanceApp key="assets" page="assets" />);
    expect(screen.queryByText("Bank A")).toBeNull();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it.each(["dashboard", "ledger", "assets", "accounts"] as const)(
    "shows the landing instead of an empty %s workspace when signed out",
    async (page) => {
      mocks.getAllAccounts.mockReturnValue([]);
      const { container } = render(<FinanceApp page={page} />);
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: "Microsoft 登录" }) as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "把生活过好，把账记清。",
      );
      expect(screen.getAllByRole("article")).toHaveLength(3);
      for (const [index, feature] of screen.getAllByRole("article").entries()) {
        const top = feature.querySelector(".landing-feature-top")!;
        expect(top.firstElementChild?.textContent).toBe(`0${index + 1}`);
        expect(top.lastElementChild?.tagName.toLowerCase()).toBe("svg");
      }
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByLabelText("记录月份")).toBeNull();
      expect(screen.queryByRole("button", { name: "新增收入来源" })).toBeNull();
      expect(
        container.querySelector(
          ".metrics, .setup-banner, .sidebar-note, .sidebar-bottom, footer",
        ),
      ).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(
        screen
          .getByRole("banner")
          .contains(screen.getByRole("button", { name: "Microsoft 登录" })),
      ).toBe(true);
      const login = screen.getByRole("button", { name: "Microsoft 登录" });
      expect(login.textContent).toBe("");
      expect(login.getAttribute("title")).toBe("Microsoft 登录");
      expect(login.querySelectorAll("svg")).toHaveLength(0);
      expect(login.querySelector("img")?.getAttribute("src")).toBe(
        `${publicConfig.basePath}/favicon.png`,
      );
      expect(
        screen.queryByText("右上角使用 Microsoft 账户登录，仅限获准的家庭成员。"),
      ).toBeNull();
      expect(screen.queryByRole("link", { name: "从这里，了解我们的账本" })).toBeNull();
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
  it("starts the existing Microsoft redirect flow from the header", async () => {
    mocks.getAllAccounts.mockReturnValue([]);
    render(<FinanceApp page="dashboard" />);
    const login = screen.getByRole("button", { name: "Microsoft 登录" });
    await waitFor(() => expect((login as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(login);
    await waitFor(() =>
      expect(mocks.loginRedirect).toHaveBeenCalledWith({
        scopes: [publicConfig.scope],
        prompt: "select_account",
      }),
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("keeps sign-in disabled while authentication initializes", async () => {
    let finishInitialization = () => {};
    const initialization = new Promise<void>((resolve) => {
      finishInitialization = resolve;
    });
    mocks.getAllAccounts.mockReturnValue([]);
    mocks.createAuth.mockReturnValue({
      ...mocks.createAuth(),
      initialize: () => initialization,
    });
    render(<FinanceApp page="dashboard" />);
    const login = screen.getByRole("button", { name: "Microsoft 登录" });
    expect((login as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("正在安全加载记录");
    finishInitialization();
    await waitFor(() => expect((login as HTMLButtonElement).disabled).toBe(false));
  });
  it("labels and disables the profile button while redirecting", async () => {
    let finishRedirect = () => {};
    mocks.getAllAccounts.mockReturnValue([]);
    mocks.loginRedirect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishRedirect = resolve;
      }),
    );
    render(<FinanceApp page="dashboard" />);
    const login = screen.getByRole("button", { name: "Microsoft 登录" });
    await waitFor(() => expect((login as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(login);
    expect(screen.getByRole("button", { name: "正在跳转…" })).toBe(login);
    expect(login.getAttribute("aria-busy")).toBe("true");
    expect((login as HTMLButtonElement).disabled).toBe(true);
    finishRedirect();
    await waitFor(() => expect((login as HTMLButtonElement).disabled).toBe(false));
    expect(login.getAttribute("aria-label")).toBe("Microsoft 登录");
    expect(login.getAttribute("aria-busy")).toBe("false");
  });
  it("disables unavailable login and explains missing configuration", () => {
    mocks.configured = false;
    render(<FinanceApp page="dashboard" />);
    expect(
      (screen.getByRole("button", { name: "Microsoft 登录" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("登录服务尚未配置");
    expect(screen.getByRole("link", { name: "配置说明" })).toBeTruthy();
    expect(mocks.createAuth).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("reports a sign-in failure and retries login instead of fetching records", async () => {
    mocks.getAllAccounts.mockReturnValue([]);
    mocks.loginRedirect.mockRejectedValueOnce(new Error("登录取消，请重试"));
    render(<FinanceApp page="dashboard" />);
    const login = screen.getByRole("button", { name: "Microsoft 登录" });
    await waitFor(() => expect((login as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(login);
    expect((await screen.findByRole("alert")).textContent).toContain("登录取消，请重试");
    fireEvent.click(screen.getByRole("button", { name: "重试登录" }));
    await waitFor(() => expect(mocks.loginRedirect).toHaveBeenCalledTimes(2));
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("opens the real dashboard after restoring a signed-in session", async () => {
    const { container } = render(<FinanceApp page="dashboard" />);
    await screen.findByRole("button", { name: "退出登录" });
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeTruthy();
    expect(screen.getByLabelText("记录年份")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "收支" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "资产" })).toBeTruthy();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(container.querySelector(".landing-hero")).toBeNull();
    expect(container.querySelector(".sidebar-note, .sidebar-bottom, footer")).toBeNull();
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        expect.anything(),
        "bootstrap",
        "GET",
        undefined,
      ),
    );
  });
  it("groups profile access with the brand and places collapse after navigation", async () => {
    const { container } = render(<FinanceApp page="dashboard" />);
    await screen.findByRole("heading", { name: "收支" });
    const sidebar = container.querySelector(".sidebar")!;
    expect(
      sidebar
        .querySelector(".brand-access")!
        .contains(screen.getByRole("button", { name: "退出登录" })),
    ).toBe(true);
    expect(sidebar.querySelector(".brand")!.firstElementChild).toBe(
      screen.getByRole("button", { name: "退出登录" }),
    );
    expect(sidebar.querySelectorAll(".profile-avatar")).toHaveLength(1);
    expect(sidebar.querySelector(".brand-mark")).toBeNull();
    expect(sidebar.lastElementChild).toBe(
      screen.getByRole("button", { name: "收起导航栏" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "收起导航栏" }));
    expect(container.querySelector(".sidebar-collapsed")).not.toBeNull();
    expect(sidebar.querySelector(".brand-name")).toBeNull();
    expect(sidebar.querySelector(".profile-avatar")).not.toBeNull();
    expect(screen.getByRole("link", { name: "月度记账" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "展开导航栏" }));
    expect(container.querySelector(".sidebar-collapsed")).toBeNull();
    expect(sidebar.querySelector(".brand-name")).not.toBeNull();
  });
  it("shows the selected year's two overview sections without monthly spending or owner/currency filters", async () => {
    const { container } = render(<FinanceApp page="dashboard" />);
    await screen.findByRole("heading", { name: "收支" });
    expect((screen.getByLabelText("记录年份") as HTMLSelectElement).value).toBe(
      String(new Date().getFullYear()),
    );
    fireEvent.change(screen.getByLabelText("记录年份"), { target: { value: "2024" } });
    expect(container.querySelectorAll(".annual-section")).toHaveLength(2);
    expect(container.querySelector(".filter-bar")).toBeNull();
    expect(container.querySelector(".summary-note")).toBeNull();
    expect(
      container
        .querySelector(".section-heading")!
        .contains(screen.getByLabelText("记录年份")),
    ).toBe(true);
    expect(container.querySelector(".metric-value")!.textContent).toBe("¥100.00");
    expect(screen.getByText("100.00%")).toBeTruthy();
    expect(screen.getByLabelText("2024 年收支趋势")).toBeTruthy();
    expect(screen.queryByLabelText("2024 年资产趋势")).toBeNull();
    expect(screen.getByRole("heading", { name: "资产分布" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "本月账户支出" })).toBeNull();
    expect(screen.queryByLabelText("归属筛选")).toBeNull();
    expect(screen.queryByText(/CNY/)).toBeNull();
  });
  it("lists twelve months in descending order and opens read-only details", async () => {
    render(<FinanceApp page="ledger" />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("记录年份"), { target: { value: "2024" } });
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(12);
    expect(rows[0].firstElementChild!.textContent).toBe("2024-12");
    expect(rows[11].firstElementChild!.textContent).toBe("2024-01");
    expect(screen.queryByLabelText("Salary 金额")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看 2024-01" }));
    const dialog = screen.getByRole("dialog", { name: "2024-01 收支详情" });
    expect(within(dialog).getByText("Salary")).toBeTruthy();
    expect(within(dialog).getByText("¥100.00")).toBeTruthy();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "保存本月记录" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows the selected year's totals above monthly accounting and keeps missing years unknown", async () => {
    render(<FinanceApp page="ledger" />);
    await screen.findByRole("heading", { name: "本年汇总" });
    fireEvent.change(screen.getByLabelText("记录年份"), { target: { value: "2024" } });
    const summary = screen.getByRole("region", { name: "2024 年收支汇总" });
    expect(summary.querySelectorAll(".metric")).toHaveLength(4);
    expect(summary.querySelector(".metric-value")!.textContent).toBe("¥100.00");
    expect(within(summary).getByText("100.00%")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("记录年份"), {
      target: { value: String(new Date().getFullYear()) },
    });
    expect(
      screen
        .getByRole("heading", { name: "本年汇总" })
        .closest("section")!
        .querySelector(".metric-value")!.textContent,
    ).toBe("—");
  });
  it("protects unsaved monthly edits on close and Escape", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    fireEvent.change(screen.getByLabelText("Salary 金额"), {
      target: { value: "250.00" },
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await editMonth();
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
      "100.00",
    );
  });
  it("saves a monthly batch through the API and reloads persisted records", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    await waitFor(() =>
      expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
        "100.00",
      ),
    );
    fireEvent.change(screen.getByLabelText("Salary 金额"), {
      target: { value: "123.45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
    await screen.findByText("已保存");
    const call = mocks.request.mock.calls.find((args) => args[1] === "months/2024-01");
    expect(monthInput.parse(call?.[3]).entries[0].amount).toBe("123.45");
    expect(screen.queryByRole("dialog")).toBeNull();
    await editMonth();
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
      "123.45",
    );
  });
  it.each(["dashboard", "ledger"] as const)(
    "selects unrecorded years with previous/next controls on %s",
    async (page) => {
      store.entries = [];
      store.periods = [];
      store.balances = [];
      render(<FinanceApp page={page} />);
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
      const currentYear = String(new Date().getFullYear());
      const previousYear = String(Number(currentYear) - 1);
      expect(
        within(screen.getByLabelText("记录年份")).getAllByRole("option"),
      ).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "上一年" }));
      expect((screen.getByLabelText("记录年份") as HTMLSelectElement).value).toBe(
        previousYear,
      );
      if (page === "ledger") {
        fireEvent.click(screen.getByRole("button", { name: `编辑 ${previousYear}-01` }));
        expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe("");
        fireEvent.change(screen.getByLabelText("Salary 金额"), {
          target: { value: "12.34" },
        });
        mocks.request.mockImplementationOnce(
          async () => new Response(JSON.stringify({ saved: true })),
        );
        fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
        await screen.findByText("已保存");
        const call = mocks.request.mock.calls.find(
          (args) => args[1] === `months/${previousYear}-01`,
        );
        expect(monthInput.parse(call?.[3]).entries[0].amount).toBe("12.34");
      }
      fireEvent.click(screen.getByRole("button", { name: "下一年" }));
      expect((screen.getByLabelText("记录年份") as HTMLSelectElement).value).toBe(
        currentYear,
      );
    },
  );
  it("selects a missing year between recorded years", async () => {
    store.periods.push({ ...store.periods[0], month: "2022-01" });
    render(<FinanceApp page="ledger" />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("记录年份"), { target: { value: "2024" } });
    fireEvent.click(screen.getByRole("button", { name: "上一年" }));
    expect((screen.getByLabelText("记录年份") as HTMLSelectElement).value).toBe("2023");
    fireEvent.click(screen.getByRole("button", { name: "编辑 2023-01" }));
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe("");
  });
  it("disables monthly actions until the post-save refresh finishes", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    fireEvent.change(screen.getByLabelText("Salary 金额"), {
      target: { value: "234.56" },
    });
    let finishLoad: (response: Response) => void = () => {};
    mocks.request
      .mockImplementationOnce(async () => new Response(JSON.stringify({ saved: true })))
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishLoad = resolve;
        }),
      );
    fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const edit = screen.getByRole("button", {
      name: "编辑 2024-01",
    }) as HTMLButtonElement;
    const view = screen.getByRole("button", {
      name: "查看 2024-01",
    }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    expect(view.disabled).toBe(true);
    fireEvent.click(edit);
    expect(screen.queryByRole("dialog")).toBeNull();
    store.entries[0].amountMinor = "23456";
    store.periods[0].version++;
    await act(async () => finishLoad(new Response(JSON.stringify(store))));
    await waitFor(() => expect(edit.disabled).toBe(false));
    fireEvent.click(edit);
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
      "234.56",
    );
  });
  it("reloads after a save even if an earlier refresh is still pending", async () => {
    render(<FinanceApp page="ledger" />);
    await editMonth();
    mocks.request.mockRejectedValueOnce(new Error("保存失败"));
    fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
    await screen.findByRole("button", { name: "重新加载" });

    const oldResponse = JSON.stringify(store);
    let finishLoad: (response: Response) => void = () => {};
    mocks.request.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishLoad = resolve;
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    fireEvent.change(screen.getByLabelText("Salary 金额"), {
      target: { value: "234.56" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存本月记录" }));
    await screen.findByText("已保存");
    expect(
      mocks.request.mock.calls.filter((call) => call[1] === "bootstrap"),
    ).toHaveLength(3);
    await act(async () => finishLoad(new Response(oldResponse)));
    await editMonth();
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
      "234.56",
    );
  });
  it("uses the recorded shared owner instead of changed account metadata", async () => {
    render(<FinanceApp page="assets" />);
    await screen.findAllByText("Bank A");
    fireEvent.change(screen.getByLabelText("记录月份"), { target: { value: "2024-01" } });
    expect(screen.queryByLabelText("归属筛选")).toBeNull();
    await waitFor(() => expect(screen.getAllByText("Bank A").length).toBeGreaterThan(0));
    expect(screen.getByText("Bank B")).toBeTruthy();
    const row = screen.getAllByText("Bank A")[0].closest("tr")!;
    expect(within(row).getByText("共同")).toBeTruthy();
    expect(screen.getAllByText("¥100.00").length).toBeGreaterThan(0);
  });
  it("updates selected assets only and never resets omitted accounts", async () => {
    render(<FinanceApp page="assets" />);
    await screen.findAllByText("Bank A");
    expect(screen.queryByRole("heading", { name: "资产趋势" })).toBeNull();
    expect(screen.getByRole("heading", { name: "估值历史" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "登记新的余额" }));
    fireEvent.change(screen.getByLabelText("Bank A 余额"), {
      target: { value: "250.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存本次估值" }));
    await screen.findByText("已保存");
    const call = mocks.request.mock.calls.find((args) => args[1] === "balances");
    expect(balanceInput.parse(call?.[3]).entries).toHaveLength(1);
    expect(balanceInput.parse(call?.[3]).entries[0].accountId).toBe("bank");
  });
  it("reports API failure without presenting mock financial records", async () => {
    mocks.request.mockRejectedValue(new Error("服务不可用"));
    render(<FinanceApp page="dashboard" />);
    await screen.findByRole("alert");
    expect(screen.getByText("服务不可用")).toBeTruthy();
    expect(screen.queryByText("¥100.00")).toBeNull();
  });
});
