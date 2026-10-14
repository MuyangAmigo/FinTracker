// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FinanceApp } from "./finance-app";
import type { Store } from "../shared/finance";
import { monthInput, balanceInput } from "../shared/finance";

const mocks = vi.hoisted(() => ({ request: vi.fn(), createAuth: vi.fn() }));
vi.mock("../lib/client", async () => {
  const actual = await vi.importActual<typeof import("../lib/client")>("../lib/client");
  return {
    ...actual,
    configured: true,
    request: mocks.request,
    createAuth: () => mocks.createAuth(),
  };
});
let store: Store;
beforeEach(() => {
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
    getAllAccounts: () => [{ username: "synthetic" }],
    setActiveAccount: () => {},
    logoutRedirect: async () => {},
    loginRedirect: async () => {},
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
