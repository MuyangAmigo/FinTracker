// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FinanceApp } from "./finance-app";
import { publicConfig } from "../lib/client";
import type { Store } from "../shared/finance";
import { monthInput, balanceInput } from "../shared/finance";

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
        store.entries[0].amountMinor = String(
          Math.round(Number(parsed.entries[0].amount) * 100),
        );
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
});
describe("household interface", () => {
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
      expect(login.querySelectorAll("svg")).toHaveLength(1);
      expect(login.querySelector("svg circle")).not.toBeNull();
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
    expect(screen.getByLabelText("记录月份")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "本月账户支出" })).toBeTruthy();
    expect(container.querySelector(".landing-hero")).toBeNull();
    expect(container.querySelector(".sidebar-note, .sidebar-bottom, footer")).toBeNull();
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(expect.anything(), "bootstrap"),
    );
  });
  it("saves a monthly batch through the API and reloads persisted records", async () => {
    render(<FinanceApp page="ledger" />);
    await screen.findByLabelText("Salary 金额");
    fireEvent.change(screen.getByLabelText("记录月份"), { target: { value: "2024-01" } });
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
    expect((screen.getByLabelText("Salary 金额") as HTMLInputElement).value).toBe(
      "123.45",
    );
  });
  it("uses the recorded shared owner instead of changed account metadata", async () => {
    render(<FinanceApp page="assets" />);
    await screen.findAllByText("Bank A");
    fireEvent.change(screen.getByLabelText("记录月份"), { target: { value: "2024-01" } });
    fireEvent.change(screen.getByLabelText("归属筛选"), { target: { value: "SHARED" } });
    await waitFor(() => expect(screen.getAllByText("Bank A").length).toBeGreaterThan(0));
    expect(screen.queryByText("Bank B")).toBeNull();
    expect(screen.getAllByText("¥100.00").length).toBeGreaterThan(0);
  });
  it("updates selected assets only and never resets omitted accounts", async () => {
    render(<FinanceApp page="assets" />);
    await screen.findAllByText("Bank A");
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
