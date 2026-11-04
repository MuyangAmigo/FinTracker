"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { configured, publicConfig } from "../lib/client";
import { useFinanceSession } from "./finance-session";
import {
  accountTypes,
  accountInput,
  balanceInput,
  monthInput,
  annualSummary,
  latestBalances,
  decimal,
  money,
  monthEnd,
  typeLabels,
  type Account,
  type Store,
} from "../shared/finance";

type Page = "dashboard" | "ledger" | "assets" | "accounts";
type Mutation = (path: string, body: unknown, method?: string) => Promise<void>;
const titles: Record<Page, [string, string]> = {
  dashboard: ["财务总览", "按年查看家庭收支与资产估值"],
  ledger: [
    "每月记一次，心里更有数。",
    "按年查看每月汇总，点击查看或编辑，在弹窗中处理月度记录。",
  ],
  assets: [
    "每一份积累，都值得看见。",
    "按实际余额登记资产。历史估值会保留，收支不会自动改变余额。",
  ],
  accounts: ["让每个账户，各归其位。", "管理个人与共同账户，以及月度收入来源。"],
};
const nav: { id: Page; href: string; label: string; icon: string }[] = [
  { id: "dashboard", href: "/", label: "财务总览", icon: "grid" },
  { id: "ledger", href: "/ledger/", label: "月度记账", icon: "book" },
  { id: "assets", href: "/assets/", label: "资产管理", icon: "wallet" },
  { id: "accounts", href: "/accounts/", label: "账户设置", icon: "settings" },
];
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    book: (
      <>
        <path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M7 3v18M11 8h5M11 12h5" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="15" rx="3" />
        <path d="M3 9V5l14-3v4M21 11h-6v5h6" />
        <path d="M17 13.5h.01" />
      </>
    ),
    settings: (
      <>
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" />
        <circle cx="12" cy="12" r="5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    up: <path d="m6 14 6-6 6 6M12 8v12" />,
    down: <path d="m6 10 6 6 6-6M12 4v12" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.wallet}
    </svg>
  );
}
function ownerName(store: Store, id: string | null) {
  return store.people.find((p) => p.id === id)?.name ?? "共同";
}
function Brand({ access, compact = false }: { access: ReactNode; compact?: boolean }) {
  return (
    <div className="brand">
      {access}
      {!compact && (
        <Link href="/" className="brand-name" aria-label="FinTracker 首页">
          FinTracker<small>一起，积累好生活</small>
        </Link>
      )}
    </div>
  );
}
function Avatar() {
  return (
    <Image
      unoptimized
      src={`${publicConfig.basePath}/favicon.png`}
      alt=""
      width={40}
      height={40}
      className="profile-avatar"
    />
  );
}
function Landing() {
  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <div className="landing-kicker">
            <span className="status-dot" />
            两个人 · 一个家 · 一本账
          </div>
          <h1 id="landing-title">
            把生活过好，
            <br />
            <em>把账记清。</em>
          </h1>
          <p className="landing-description">
            不必追着每一笔开销跑。
            <br />
            每月一起理清收支，看看积累，
            <br />
            为想要的生活，留一份从容。
          </p>
        </div>
        <div className="landing-visual" aria-hidden="true">
          <div className="landing-orbit" />
          <div className="landing-notebook">
            <div className="notebook-heading">
              <Icon name="home" size={21} />
              <span>THE HOME LEDGER</span>
            </div>
            <div className="notebook-title">
              生活有度，
              <br />
              积累有迹。
            </div>
            <div className="notebook-rule" />
            <div className="notebook-chart">
              <span>把日子，慢慢过成喜欢的样子</span>
              <svg viewBox="0 0 280 105" fill="none">
                <path className="notebook-chart-grid" d="M0 25h280M0 60h280M0 95h280" />
                <path
                  className="notebook-chart-line"
                  d="M4 88C28 88 24 65 49 69S80 82 103 58s35 5 58-17 29 1 51-15 36-5 64-21"
                />
              </svg>
            </div>
            <div className="notebook-bottom">
              <span>OUR LIFE, IN BALANCE</span>
              <Icon name="home" size={17} />
            </div>
          </div>
          <div className="landing-label label-income">
            <span>
              <Icon name="book" size={20} />
            </span>
            收支有数
          </div>
          <div className="landing-label label-home">
            <span>
              <Icon name="home" size={20} />
            </span>
            心里有底，生活有光
          </div>
        </div>
      </section>
      <section
        className="landing-features"
        id="landing-features"
        aria-label="账本能帮你做什么"
      >
        {[
          {
            icon: "book",
            number: "01",
            title: "每月一次，收支有数",
            text: "按月整理收入与账户支出，不必逐笔打卡，也能看清生活的节奏。",
          },
          {
            icon: "wallet",
            number: "02",
            title: "每份积累，都看得见",
            text: "存款、投资、房产与车辆，独立记录实际余额，留住每一次积累。",
          },
          {
            icon: "lock",
            number: "03",
            title: "两个人的，私人空间",
            text: "个人与共同账户清晰分开，家庭记录仅向获准成员开放。",
          },
        ].map((feature) => (
          <article className="landing-feature" key={feature.number}>
            <div className="landing-feature-top">
              <span>{feature.number}</span>
              <Icon name={feature.icon} size={22} />
            </div>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>
      {!configured && (
        <div className="landing-setup" role="status">
          <Icon name="lock" size={16} />
          <p>登录服务尚未配置，连接 Microsoft 登录和私人 API 后即可使用。</p>
          <a
            href="https://github.com/MuyangAmigo/FinTracker#deployment"
            target="_blank"
            rel="noreferrer"
          >
            配置说明 <Icon name="arrow" size={14} />
          </a>
        </div>
      )}
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="book" size={26} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}

export function FinanceApp({ page }: { page: Page }) {
  const {
    auth,
    signedIn,
    loading,
    store,
    error,
    setError,
    apiRequest,
    refresh,
    signOut,
    sidebarCollapsed: collapsed,
    setSidebarCollapsed: setCollapsed,
  } = useFinanceSession();
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(today().slice(0, 4));
  const [ledgerMode, setLedgerMode] = useState<"view" | "edit" | null>(null);
  const [modal, setModal] = useState<"account" | "income" | "balance" | null>(null),
    [editing, setEditing] = useState<Account | undefined>();
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const guardNavigation = () => !dirty || window.confirm("有未保存的修改，确定离开吗？");
  const mutate: Mutation = async (path, body, method = "POST") => {
    if (!auth.current) throw new Error("请先登录");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(path, method, body);
      setDirty(false);
      setModal(null);
      setLedgerMode(null);
      setEditing(undefined);
      try {
        await refresh(true);
      } catch (e) {
        throw new Error(`已保存，但无法重新加载记录：${message(e)}`);
      }
      setNotice("已保存");
    } catch (e) {
      setError(message(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  async function signIn() {
    if (!auth.current) {
      setError("登录尚未就绪，请稍后重试");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.current.loginRedirect({
        scopes: [publicConfig.scope],
        prompt: "select_account",
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(kind: string) {
    if (!auth.current) return;
    try {
      const response = await apiRequest(`export/${kind}`);
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fintracker-${kind}.${kind === "backup" ? "json" : "csv"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(message(e));
    }
  }
  const period = store?.periods.find((p) => p.month === month);
  const years = [
    ...new Set([
      today().slice(0, 4),
      year,
      ...(store?.periods.map((p) => p.month.slice(0, 4)) ?? []),
      ...(store?.entries.map((e) => e.month.slice(0, 4)) ?? []),
      ...(store?.balances.map((b) => b.asOf.slice(0, 4)) ?? []),
    ]),
  ]
    .sort()
    .reverse();
  const yearEnd = `${year}-12-31`;
  const asOf = yearEnd < today() ? yearEnd : today();
  const yearControl = (
    <div className="year-control">
      <button
        type="button"
        className="text-button"
        aria-label="上一年"
        disabled={busy || Number(year) === 0}
        onClick={() => setYear(String(Number(year) - 1).padStart(4, "0"))}
      >
        上一年
      </button>
      <label>
        <span className="sr-only">记录年份</span>
        <select value={year} disabled={busy} onChange={(e) => setYear(e.target.value)}>
          {years.map((value) => (
            <option key={value} value={value}>
              {value} 年
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="text-button"
        aria-label="下一年"
        disabled={busy || Number(year) === 9999}
        onClick={() => setYear(String(Number(year) + 1).padStart(4, "0"))}
      >
        下一年
      </button>
    </div>
  );
  const closeLedger = () => {
    if (!guardNavigation()) return;
    setLedgerMode(null);
    setDirty(false);
  };
  const selectMonth = (value: string, mode: "view" | "edit") => {
    if (value === month && mode === ledgerMode) return;
    if (busy || !guardNavigation()) return;
    setMonth(value);
    setLedgerMode(mode);
    setDirty(false);
    setNotice("");
  };
  const open = (value: "account" | "income" | "balance", account?: Account) => {
    if (!busy && guardNavigation()) {
      setEditing(account);
      setLedgerMode(null);
      setDirty(false);
      setModal(value);
      setError("");
    }
  };
  return (
    <div
      className={`app-shell${signedIn ? (collapsed ? " sidebar-collapsed" : "") : " guest-shell"}`}
    >
      {signedIn && (
        <aside className="sidebar">
          <div className="brand-access">
            <Brand
              compact={collapsed}
              access={
                <button
                  className="login-button"
                  aria-label="退出登录"
                  title="退出登录"
                  onClick={() => {
                    if (guardNavigation())
                      void signOut().catch((e: unknown) => setError(message(e)));
                  }}
                >
                  <Avatar />
                </button>
              }
            />
          </div>
          <div className="space-label">家庭财务空间</div>
          <nav aria-label="主导航">
            {nav.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={(e) => {
                  if (!guardNavigation()) e.preventDefault();
                }}
              >
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {page === item.id && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <button
            className="sidebar-toggle"
            aria-label={collapsed ? "展开导航栏" : "收起导航栏"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Icon name="arrow" size={18} />
            <span>{collapsed ? "展开" : "收起导航栏"}</span>
          </button>
        </aside>
      )}
      <div className="workspace">
        {!signedIn && (
          <header className="topbar">
            <div className="brand-access">
              <Brand
                access={
                  <button
                    className="login-button"
                    disabled={!configured || loading || busy}
                    aria-busy={loading || busy}
                    aria-label={busy ? "正在跳转…" : "Microsoft 登录"}
                    title={busy ? "正在跳转…" : "Microsoft 登录"}
                    onClick={() => void signIn()}
                  >
                    <Avatar />
                  </button>
                }
              />
            </div>
          </header>
        )}
        <main className={signedIn ? undefined : "landing-main"}>
          {signedIn && (
            <div className="page-heading">
              <div>
                <h1>{titles[page][0]}</h1>
                <p>{titles[page][1]}</p>
              </div>
              {(page === "assets" || page === "accounts") && (
                <button
                  className="primary-button"
                  disabled={!store || busy}
                  onClick={() => (page === "assets" ? open("balance") : open("account"))}
                >
                  <Icon name="plus" size={18} />
                  {page === "assets" ? "登记资产" : "新增账户"}
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="text-button"
                disabled={!signedIn && (!configured || loading || busy)}
                onClick={() =>
                  signedIn
                    ? void refresh().catch((e: unknown) => setError(message(e)))
                    : void signIn()
                }
              >
                {signedIn ? "重新加载" : "重试登录"}
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {loading && (
            <div role="status" className="alert">
              正在安全加载记录…
            </div>
          )}
          {!signedIn ? (
            <Landing />
          ) : (
            <>
              {page !== "accounts" && page !== "dashboard" && (
                <div className="filter-bar">
                  <span className="selected">
                    {page === "assets" ? "资产估值" : "年度视图"}
                  </span>
                  <div className="filters">
                    {page === "assets" ? (
                      <label>
                        <span className="sr-only">记录月份</span>
                        <input
                          type="month"
                          value={month}
                          onChange={(e) => {
                            if (e.target.value && guardNavigation()) {
                              setMonth(e.target.value);
                              setDirty(false);
                            }
                          }}
                        />
                      </label>
                    ) : (
                      yearControl
                    )}
                  </div>
                </div>
              )}
              {page === "dashboard" &&
                (store ? (
                  <Dashboard
                    store={store}
                    year={year}
                    asOf={asOf}
                    yearControl={yearControl}
                  />
                ) : (
                  <section className="panel">
                    <Empty title="财务总览" text="正在等待真实家庭记录。" />
                  </section>
                ))}
              {page === "ledger" &&
                (store ? (
                  <>
                    <section aria-label={`${year} 年收支汇总`}>
                      <div className="section-heading">
                        <h2>本年汇总</h2>
                        <p>{year} 年 · 已登记数据</p>
                      </div>
                      <AnnualMetrics store={store} year={year} />
                    </section>
                    <MonthlyTable
                      store={store}
                      year={year}
                      onOpen={selectMonth}
                      busy={busy}
                    />
                  </>
                ) : (
                  <section className="panel">
                    <Empty
                      title="月度记账"
                      text="登录并连接私人 API 后，即可批量录入每个月的收入与账户支出。"
                    />
                  </section>
                ))}
              {page === "assets" &&
                (store ? (
                  <Assets
                    store={store}
                    month={month}
                    owner="ALL"
                    onRecord={() => open("balance")}
                  />
                ) : (
                  <section className="panel">
                    <Empty
                      title="资产管理"
                      text="登记实际资产余额，保留每一次估值的历史。"
                    />
                  </section>
                ))}
              {page === "accounts" &&
                (store ? (
                  <Accounts
                    store={store}
                    onEdit={(a) => open("account", a)}
                    onAdd={() => open("account")}
                    onIncome={() => open("income")}
                  />
                ) : (
                  <section className="panel">
                    <Empty
                      title="你的账户，你来定义"
                      text="信用卡、公用小荷包、存款、投资、房产和车辆，都能在这里管理。"
                    />
                  </section>
                ))}
              {store && (
                <div className="export-bar">
                  <span>你的记录，始终由你掌握。</span>
                  <button onClick={() => void download("monthly")}>导出月度收支</button>
                  <button onClick={() => void download("assets")}>导出资产历史</button>
                  <button onClick={() => void download("backup")}>完整数据备份</button>
                </div>
              )}
              {ledgerMode && !modal && store && (
                <Modal
                  title={`${month} ${ledgerMode === "view" ? "收支详情" : "编辑月度记录"}`}
                  onClose={closeLedger}
                  busy={busy}
                  wide
                >
                  <div className="monthly-dialog">
                    <Ledger
                      key={`${month}:${period?.version ?? 0}:${ledgerMode}`}
                      store={store}
                      month={month}
                      owner="ALL"
                      mutate={mutate}
                      busy={busy}
                      onDirty={setDirty}
                      onAddAccount={() => open("account")}
                      onAddIncome={() => open("income")}
                      readOnly={ledgerMode === "view"}
                    />
                  </div>
                </Modal>
              )}
            </>
          )}
        </main>
      </div>
      {modal && store && (
        <Modal
          title={
            modal === "balance"
              ? "登记资产余额"
              : modal === "income"
                ? "新增收入来源"
                : editing
                  ? "编辑账户"
                  : "新增账户"
          }
          onClose={() => {
            setModal(null);
            setEditing(undefined);
          }}
          busy={busy}
        >
          {modal === "balance" ? (
            <BalanceForm store={store} mutate={mutate} busy={busy} />
          ) : (
            <AccountForm
              key={editing?.id ?? modal}
              store={store}
              account={editing}
              income={modal === "income"}
              mutate={mutate}
              busy={busy}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <section className={`metric${emphasis ? " metric-emphasis" : ""}`}>
      <h3 className="metric-top">{label}</h3>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </section>
  );
}
function PanelTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
function AnnualMetrics({ store, year }: { store: Store; year: string }) {
  const annual = annualSummary(store, year);
  return (
    <div className="metrics">
      <Metric
        label="总收入"
        value={annual.incomeRecorded ? money(annual.income) : "—"}
        note="本年已登记收入"
      />
      <Metric
        label="总支出"
        value={annual.expenseRecorded ? money(annual.expense) : "—"}
        note="本年已登记支出"
      />
      <Metric
        label="总结余"
        value={
          annual.incomeRecorded || annual.expenseRecorded ? money(annual.savings) : "—"
        }
        note={
          annual.recordedMonths > annual.completeMonths
            ? "未完成月份仅计已记录差额"
            : "已登记收入 − 已登记支出"
        }
        emphasis
      />
      <Metric
        label="储蓄率"
        value={annual.rate ?? "暂不适用"}
        note="记录完整且总收入为正时计算"
      />
    </div>
  );
}
function Dashboard({
  store,
  year,
  asOf,
  yearControl,
}: {
  store: Store;
  year: string;
  asOf: string;
  yearControl: ReactNode;
}) {
  const balances = latestBalances(store, asOf);
  const total = balances.reduce((sum, balance) => sum + BigInt(balance.amountMinor), 0n);
  return (
    <div className="annual-dashboard">
      <section className="annual-section" aria-labelledby="income-section">
        <div className="section-heading">
          <h2 id="income-section">收支</h2>
          {yearControl}
        </div>
        <AnnualMetrics store={store} year={year} />
        <section className="panel">
          <PanelTitle
            title="每月收支趋势"
            subtitle="按月份比较收支金额大小；负数及准确金额见下表，未完成月份以 * 标注"
            right={
              <div className="legend">
                <i className="income-key" />
                收入
                <i className="expense-key" />
                支出
              </div>
            }
          />
          <Trend store={store} year={year} />
        </section>
      </section>
      <section className="annual-section" aria-labelledby="asset-section">
        <div className="section-heading">
          <h2 id="asset-section">资产</h2>
          <p>截至 {asOf} · 独立于月度收支</p>
        </div>
        <div className="asset-overview">
          <div className="asset-summary">
            <div>
              <small>总资产</small>
              <strong>{balances.length ? money(total) : "—"}</strong>
              <span>
                {balances.length} 个已登记资产；未更新账户沿用历史估值，未知余额不计为零。
              </span>
            </div>
          </div>
          <section className="panel asset-distribution">
            <PanelTitle title="资产分布" subtitle="金融资产、房产及车辆" />
            {balances.length ? (
              <Composition store={store} asOf={asOf} owner="ALL" />
            ) : (
              <Empty title="尚未登记资产余额" text="登记实际余额后显示资产分布。" />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
function MonthlyTable({
  store,
  year,
  onOpen,
  busy,
}: {
  store: Store;
  year: string;
  onOpen: (month: string, mode: "view" | "edit") => void;
  busy: boolean;
}) {
  const rows = annualSummary(store, year).months.toReversed();
  return (
    <section className="panel">
      <PanelTitle
        title={`${year} 年每月汇总`}
        subtitle="按月份倒序排列；查看或编辑在弹窗中打开，空白与零分别显示"
      />
      <div className="table-scroll">
        <table aria-label={`${year} 年每月汇总`}>
          <thead>
            <tr>
              <th>月份</th>
              <th className="numeric">收入</th>
              <th className="numeric">支出</th>
              <th className="numeric">结余</th>
              <th className="numeric">储蓄率</th>
              <th>收入状态</th>
              <th>支出状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td className="numeric">
                  {row.incomeRecorded ? money(row.income) : "未记录"}
                </td>
                <td className="numeric">
                  {row.expenseRecorded ? money(row.expense) : "未记录"}
                </td>
                <td className="numeric">
                  {row.incomeRecorded || row.expenseRecorded ? money(row.savings) : "—"}
                  {row.recorded && !row.complete ? " *" : ""}
                </td>
                <td className="numeric">{row.rate ?? "—"}</td>
                {(["incomeComplete", "expenseComplete"] as const).map((kind) => {
                  const period = store.periods.find(
                    (period) => period.month === row.month,
                  );
                  return (
                    <td key={kind}>
                      {period?.[kind] ? "完整" : row.recorded ? "未完成" : "未记录"}
                    </td>
                  );
                })}
                <td>
                  <div className="row-actions">
                    <button
                      className="text-button"
                      aria-label={`查看 ${row.month}`}
                      disabled={busy}
                      onClick={() => onOpen(row.month, "view")}
                    >
                      查看
                    </button>
                    <button
                      className="text-button"
                      aria-label={`编辑 ${row.month}`}
                      disabled={busy}
                      onClick={() => onOpen(row.month, "edit")}
                    >
                      编辑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-footer">
        * 未完成月份的结余为已记录差额，不能代表完整月度结余。
      </div>
    </section>
  );
}
function Trend({ store, year }: { store: Store; year: string }) {
  const points = annualSummary(store, year).months;
  const maximum = points.reduce(
    (largest, point) =>
      [point.income, point.expense].reduce((max, amount) => {
        const absolute = amount < 0n ? -amount : amount;
        return absolute > max ? absolute : max;
      }, largest),
    0n,
  );
  // Keep both axis ticks on whole minor units.
  const scaleMinor = maximum + (maximum % 2n);
  const scale = Number(scaleMinor || 1n);
  const recorded = points.some((point) => point.recorded);
  return (
    <>
      <div
        className="chart-scroll"
        role="region"
        aria-label="月度收支图表，可横向滚动"
        tabIndex={0}
      >
        <div className="trend-chart">
          <div className="chart-axis" aria-hidden="true">
            <span>{scaleMinor > 0n ? money(scaleMinor) : ""}</span>
            <span>{scaleMinor > 0n ? money(scaleMinor / 2n) : ""}</span>
            <span>{recorded ? money(0n) : "—"}</span>
          </div>
          <div className="chart" role="img" aria-label={`${year} 年收支趋势`}>
            {points.map((p, i) => (
              <div
                key={p.month}
                className="chart-column"
                title={`${p.month} 收入 ${p.incomeRecorded ? money(p.income) : "未记录"}，支出 ${p.expenseRecorded ? money(p.expense) : "未记录"}${p.recorded && !p.complete ? "（未完成）" : ""}`}
              >
                <div className="chart-bars">
                  {p.incomeRecorded && (
                    <span
                      className="income-bar"
                      style={{
                        height: `${Math.max(2, (Math.abs(Number(p.income)) / scale) * 100)}%`,
                      }}
                    />
                  )}
                  {p.expenseRecorded && (
                    <span
                      className="expense-bar"
                      style={{
                        height: `${Math.max(2, (Math.abs(Number(p.expense)) / scale) * 100)}%`,
                      }}
                    />
                  )}
                  {!p.incomeRecorded && !p.expenseRecorded && (
                    <span className="missing-bar" />
                  )}
                </div>
                <span>
                  {i + 1}月{p.recorded && !p.complete ? "*" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="chart-scroll-hint">左右滑动查看全年，或展开下表</p>
      <details className="chart-data">
        <summary>查看准确数值</summary>
        <div className="disclosure-content">
          <div className="table-scroll">
            <table aria-label={`${year} 年收支准确数值`}>
              <thead>
                <tr>
                  <th>月份</th>
                  <th className="numeric">收入</th>
                  <th className="numeric">支出</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.month}>
                    <td>{p.month}</td>
                    <td className="numeric">
                      {p.incomeRecorded ? money(p.income) : "未记录"}
                    </td>
                    <td className="numeric">
                      {p.expenseRecorded ? money(p.expense) : "未记录"}
                    </td>
                    <td>{!p.recorded ? "未记录" : p.complete ? "完整" : "未完成"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}
function Composition({
  store,
  asOf,
  owner,
}: {
  store: Store;
  asOf: string;
  owner: string;
}) {
  const balances = latestBalances(store, asOf, owner),
    values = new Map<string, bigint>();
  for (const b of balances) {
    const type = store.accounts.find((a) => a.id === b.accountId)!.type;
    values.set(type, (values.get(type) ?? 0n) + BigInt(b.amountMinor));
  }
  const sum = [...values.values()].reduce((a, b) => a + b, 0n),
    colors = ["#26745b", "#6e8f80", "#849b8f", "#a3b2a9", "#bcc8c0", "#51695e"];
  const segments = [...values]
    .filter(([, v]) => v > 0n)
    .map(([type, value], i) => ({ type, value, color: colors[i % colors.length] }));
  let cursor = 0;
  const stops = segments
    .map((s) => {
      const start = cursor;
      cursor += (Number(s.value) / Number(sum)) * 100;
      return `${s.color} ${start}% ${cursor}%`;
    })
    .join(", ");
  return (
    <div className="composition">
      <div
        className="donut"
        style={{ background: sum > 0n ? `conic-gradient(${stops})` : "var(--border)" }}
        role="img"
        aria-label="资产类型分布"
      >
        <div>
          <small>已登记资产</small>
          <strong>{balances.length}</strong>
          <span>个资产</span>
        </div>
      </div>
      <div className="composition-list">
        {segments.map((s) => (
          <div key={s.type}>
            <span>
              <i style={{ background: s.color }} />
              {typeLabels[s.type as Account["type"]]}
            </span>
            <strong>{money(s.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function Ledger({
  store,
  month,
  owner,
  mutate,
  busy,
  onDirty,
  onAddAccount,
  onAddIncome,
  readOnly = false,
}: {
  store: Store;
  month: string;
  owner: string;
  mutate: Mutation;
  busy: boolean;
  onDirty: (value: boolean) => void;
  onAddAccount: () => void;
  onAddIncome: () => void;
  readOnly?: boolean;
}) {
  const entries = store.entries.filter((e) => e.month === month);
  const recordedOwner = (line: Store["lines"][number]) => {
    const entry = entries.find((e) => e.lineId === line.id);
    return entry ? entry.ownerId : line.ownerId;
  };
  const [values, setValues] = useState<Record<string, { amount: string; note: string }>>(
    () =>
      Object.fromEntries(
        store.lines.map((l) => {
          const e = entries.find((r) => r.lineId === l.id);
          return [l.id, { amount: e ? decimal(e.amountMinor) : "", note: e?.note ?? "" }];
        }),
      ),
  );
  const period = store.periods.find((p) => p.month === month);
  const [incomeComplete, setIncomeComplete] = useState(period?.incomeComplete ?? false),
    [expenseComplete, setExpenseComplete] = useState(period?.expenseComplete ?? false),
    [error, setError] = useState("");
  const lines = store.lines.filter(
    (l) => !l.archived || entries.some((e) => e.lineId === l.id),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const payload = monthInput.parse({
        version: period?.version ?? 0,
        incomeComplete,
        expenseComplete,
        entries: lines.map((l) => ({
          lineId: l.id,
          amount: values[l.id]?.amount.trim() || null,
          note: values[l.id]?.note ?? "",
        })),
      });
      if (
        entries.some((e) => !values[e.lineId]?.amount.trim()) &&
        !window.confirm("清空金额会删除对应的本月记录。确定保存吗？")
      )
        return;
      await mutate(`months/${month}`, payload, "PUT");
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <form onSubmit={(e) => void save(e)}>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      {(["INCOME", "EXPENSE"] as const).map((kind) => (
        <section className="panel ledger-panel" key={kind}>
          <PanelTitle
            title={kind === "INCOME" ? "月度收入" : "账户支出"}
            subtitle={
              kind === "INCOME"
                ? "工资、股权、其他收入"
                : "记录消费支出，不重复记录信用卡还款或账户转账"
            }
            right={
              !readOnly && (
                <button
                  type="button"
                  className="subtle-link"
                  onClick={kind === "INCOME" ? onAddIncome : onAddAccount}
                >
                  <Icon name="plus" size={16} />
                  新增{kind === "INCOME" ? "来源" : "账户"}
                </button>
              )
            }
          />
          <div className="table-scroll">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>{kind === "INCOME" ? "收入来源" : "账户"}</th>
                  <th>归属</th>
                  <th>金额</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter(
                    (l) =>
                      l.kind === kind &&
                      (owner === "ALL" || (recordedOwner(l) ?? "SHARED") === owner),
                  )
                  .map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.name}
                        {line.archived && <small> · 已归档</small>}
                      </td>
                      <td>
                        <span className="owner-tag">
                          {ownerName(store, recordedOwner(line))}
                        </span>
                      </td>
                      <td>
                        {readOnly ? (
                          values[line.id]?.amount ? (
                            money(
                              entries.find((entry) => entry.lineId === line.id)!
                                .amountMinor,
                            )
                          ) : (
                            "未记录"
                          )
                        ) : (
                          <input
                            aria-label={`${line.name} 金额`}
                            inputMode="decimal"
                            placeholder="尚未记录"
                            value={values[line.id]?.amount ?? ""}
                            onChange={(e) => {
                              setValues((v) => ({
                                ...v,
                                [line.id]: { ...v[line.id], amount: e.target.value },
                              }));
                              onDirty(true);
                            }}
                          />
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          <span className="entry-note">
                            {values[line.id]?.note || "—"}
                          </span>
                        ) : (
                          <input
                            aria-label={`${line.name} 备注`}
                            maxLength={500}
                            placeholder="选填"
                            value={values[line.id]?.note ?? ""}
                            onChange={(e) => {
                              setValues((v) => ({
                                ...v,
                                [line.id]: { ...v[line.id], note: e.target.value },
                              }));
                              onDirty(true);
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!lines.some((l) => l.kind === kind) && (
            <Empty
              title="先添加一行"
              text="新账户或收入来源会自动出现在每个月的记账表中。"
            />
          )}
          <div className="panel-footer">
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={readOnly || owner !== "ALL"}
                checked={kind === "INCOME" ? incomeComplete : expenseComplete}
                onChange={(e) => {
                  if (kind === "INCOME") setIncomeComplete(e.target.checked);
                  else setExpenseComplete(e.target.checked);
                  onDirty(true);
                }}
              />
              {kind === "INCOME"
                ? "全家庭本月收入已记录完整"
                : "全家庭本月支出已记录完整"}
            </label>
            <span>空白 ≠ 零</span>
          </div>
        </section>
      ))}
      {!readOnly && (
        <div className="save-bar">
          <span>保存不会修改任何资产余额。</span>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "保存中…" : "保存本月记录"}
          </button>
        </div>
      )}
    </form>
  );
}
function Assets({
  store,
  month,
  owner,
  onRecord,
}: {
  store: Store;
  month: string;
  owner: string;
  onRecord: () => void;
}) {
  const balances = latestBalances(store, monthEnd(month), owner),
    total = balances.reduce((v, b) => v + BigInt(b.amountMinor), 0n);
  const visibleAccounts = store.accounts.filter((a) => {
    const balance = latestBalances(store, monthEnd(month)).find(
      (b) => b.accountId === a.id,
    );
    const recordedOwner = balance ? balance.ownerId : a.ownerId;
    return a.assetEnabled && (owner === "ALL" || (recordedOwner ?? "SHARED") === owner);
  });
  return (
    <>
      <div className="asset-summary">
        <div>
          <small>截至 {month} 的最近已知资产</small>
          <strong>{balances.length ? money(total) : "—"}</strong>
          <span>未更新的账户沿用旧估值，未知余额不计为零。</span>
        </div>
        <button className="primary-button" onClick={onRecord}>
          <Icon name="plus" size={18} />
          登记新的余额
        </button>
      </div>
      <section className="panel">
        <PanelTitle title="账户与资产" subtitle="查看每个余额的实际记录日期" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>资产账户</th>
                <th>类型</th>
                <th>归属</th>
                <th className="numeric">最近余额</th>
                <th>估值日期</th>
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map((a) => {
                const b = balances.find((v) => v.accountId === a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      {a.archived && <small> · 已归档</small>}
                    </td>
                    <td>{typeLabels[a.type]}</td>
                    <td>
                      <span className="owner-tag">
                        {ownerName(store, b ? b.ownerId : a.ownerId)}
                      </span>
                    </td>
                    <td className="numeric">{b ? money(b.amountMinor) : "未知"}</td>
                    <td>
                      {b ? (
                        <>
                          {b.precision === "MONTH" ? b.asOf.slice(0, 7) : b.asOf}
                          {b.asOf.slice(0, 7) !== month && (
                            <span className="old-balance">历史估值</span>
                          )}
                        </>
                      ) : (
                        "未登记"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleAccounts.length && (
          <Empty title="还没有资产账户" text="在账户设置里添加银行、投资、房产或车辆。" />
        )}
      </section>
      <section className="panel history-panel">
        <PanelTitle title="估值历史" subtitle="每一次记录都保留，不由月度收支推算" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>账户</th>
                <th>归属</th>
                <th className="numeric">余额</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {store.balances
                .filter(
                  (b) =>
                    b.asOf <= monthEnd(month) &&
                    (owner === "ALL" || (b.ownerId ?? "SHARED") === owner),
                )
                .toSorted((a, b) => b.asOf.localeCompare(a.asOf))
                .map((b) => (
                  <tr key={b.id}>
                    <td>{b.precision === "MONTH" ? b.asOf.slice(0, 7) : b.asOf}</td>
                    <td>{store.accounts.find((a) => a.id === b.accountId)?.name}</td>
                    <td>{ownerName(store, b.ownerId)}</td>
                    <td className="numeric">{money(b.amountMinor)}</td>
                    <td>{b.note || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {store.references.length > 0 && (
        <details className="panel references">
          <summary>原始表格汇总参考（不重复计入资产）</summary>
          <div className="disclosure-content">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>期间</th>
                    <th>参考类型</th>
                    <th>归属</th>
                    <th>原始值</th>
                    <th>原始说明</th>
                  </tr>
                </thead>
                <tbody>
                  {store.references
                    .filter(
                      (r) =>
                        r.period <= month &&
                        (owner === "ALL" || (r.ownerId ?? "SHARED") === owner),
                    )
                    .map((r) => (
                      <tr key={r.id}>
                        <td>{r.period}</td>
                        <td>{r.kind}</td>
                        <td>{ownerName(store, r.ownerId)}</td>
                        <td>{r.valueMinor !== null ? money(r.valueMinor) : "—"}</td>
                        <td>{r.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </>
  );
}
function Accounts({
  store,
  onEdit,
  onAdd,
  onIncome,
}: {
  store: Store;
  onEdit: (a: Account) => void;
  onAdd: () => void;
  onIncome: () => void;
}) {
  return (
    <>
      <section className="panel">
        <PanelTitle
          title="账户与资产项目"
          subtitle="归档保留历史，不会自动抹去资产余额"
          right={
            <button className="subtle-link" onClick={onAdd}>
              <Icon name="plus" size={16} />
              新增账户
            </button>
          }
        />
        <div className="account-grid">
          {store.accounts.map((a) => (
            <button
              key={a.id}
              className={`account-card ${a.archived ? "archived" : ""}`}
              onClick={() => onEdit(a)}
            >
              <span className="account-card-icon">
                <Icon name="wallet" size={23} />
              </span>
              <strong>{a.name}</strong>
              <span>
                {typeLabels[a.type]} · {ownerName(store, a.ownerId)}
              </span>
              <div>
                <span className="mini-tag">{a.assetEnabled ? "资产" : "仅记账"}</span>
                {a.expenseEnabled && <span className="mini-tag">月度支出</span>}
                {a.archived && <span className="mini-tag">已归档</span>}
              </div>
            </button>
          ))}
        </div>
        {!store.accounts.length && (
          <Empty title="先添加一个账户" text="账户名称、归属和类型都可以由你定义。" />
        )}
      </section>
      <section className="panel history-panel">
        <PanelTitle
          title="收入来源"
          subtitle="新增来源会出现在每个月的收入表里"
          right={
            <button className="subtle-link" onClick={onIncome}>
              <Icon name="plus" size={16} />
              新增来源
            </button>
          }
        />
        <div className="source-list">
          {store.lines
            .filter((l) => l.kind === "INCOME")
            .map((l) => (
              <div key={l.id}>
                <Icon name="down" size={18} />
                <strong>{l.name}</strong>
                <span className="owner-tag">{ownerName(store, l.ownerId)}</span>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
function Modal({
  title,
  children,
  onClose,
  busy,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const node = dialog.current;
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal${wide ? " modal-wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          disabled={busy}
          className="icon-button"
          aria-label="关闭"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function AccountForm({
  store,
  account,
  income,
  mutate,
  busy,
}: {
  store: Store;
  account?: Account;
  income: boolean;
  mutate: Mutation;
  busy: boolean;
}) {
  const [name, setName] = useState(account?.name ?? ""),
    [owner, setOwner] = useState(account?.ownerId ?? ""),
    [type, setType] = useState<Account["type"]>(account?.type ?? "BANK");
  const [asset, setAsset] = useState(account?.assetEnabled ?? true),
    [expense, setExpense] = useState(account?.expenseEnabled ?? false),
    [archived, setArchived] = useState(account?.archived ?? false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (income) await mutate("sources", { name, ownerId: owner || null });
      else {
        const value = accountInput.parse({
          name,
          ownerId: owner || null,
          type,
          assetEnabled: asset,
          expenseEnabled: expense,
          archived,
          version: account?.version,
        });
        await mutate(
          account ? `accounts/${account.id}` : "accounts",
          value,
          account ? "PUT" : "POST",
        );
      }
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="modal-form">
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <label>
        名称
        <input
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={income ? "例如：工资" : "例如：信用卡、公用小荷包"}
        />
      </label>
      <label>
        归属
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">共同</option>
          {store.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {!income && (
        <>
          <label>
            类型
            <select
              value={type}
              onChange={(e) => {
                const next = accountTypes.find((t) => t === e.target.value)!;
                setType(next);
                if (next === "CREDIT_CARD") {
                  setAsset(false);
                  setExpense(true);
                }
              }}
            >
              {accountTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={asset}
              disabled={type === "CREDIT_CARD"}
              onChange={(e) => setAsset(e.target.checked)}
            />
            用于资产余额
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={expense}
              onChange={(e) => setExpense(e.target.checked)}
            />
            用于月度支出
          </label>
          {account && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              归档账户（保留历史和非零资产余额）
            </label>
          )}
        </>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
function BalanceForm({
  store,
  mutate,
  busy,
}: {
  store: Store;
  mutate: Mutation;
  busy: boolean;
}) {
  const [date, setDate] = useState(today()),
    [precision, setPrecision] = useState<"DAY" | "MONTH">("DAY");
  const effective = precision === "MONTH" ? monthEnd(date.slice(0, 7)) : date;
  const accounts = store.accounts.filter((a) => a.assetEnabled && !a.archived);
  const [values, setValues] = useState<Record<string, string>>({}),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const previous = latestBalances(store, effective);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const entries = accounts
        .filter((a) => values[a.id]?.trim())
        .map((a) => ({
          accountId: a.id,
          amount: values[a.id].trim(),
          note: notes[a.id] ?? "",
          version:
            store.balances.find((b) => b.accountId === a.id && b.asOf === effective)
              ?.version ?? null,
        }));
      await mutate("balances", balanceInput.parse({ asOf: date, precision, entries }));
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="modal-form">
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="form-row">
        <label>
          估值日期
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setValues({});
                setNotes({});
              }
            }}
          />
        </label>
        <label>
          日期精度
          <select
            value={precision}
            onChange={(e) => {
              setPrecision(e.target.value === "MONTH" ? "MONTH" : "DAY");
              setValues({});
              setNotes({});
            }}
          >
            <option value="DAY">确切日期</option>
            <option value="MONTH">仅知道月份</option>
          </select>
        </label>
      </div>
      <p className="muted">
        只保存填写的账户。空白不会将旧余额重置为零。同日期填写会更新该次估值。
      </p>
      <div className="balance-fields">
        {accounts.map((a) => (
          <div key={a.id}>
            <label>
              {a.name}
              <small>
                {ownerName(store, a.ownerId)} ·{" "}
                {previous.find((b) => b.accountId === a.id)
                  ? `最近 ${money(previous.find((b) => b.accountId === a.id)!.amountMinor)}`
                  : "未登记"}
              </small>
              <input
                aria-label={`${a.name} 余额`}
                inputMode="decimal"
                placeholder="本次不更新"
                value={values[a.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
              />
            </label>
            <input
              aria-label={`${a.name} 估值备注`}
              maxLength={500}
              placeholder="备注（选填）"
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes((v) => ({ ...v, [a.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <button className="primary-button" disabled={busy || !accounts.length}>
        {busy ? "保存中…" : "保存本次估值"}
      </button>
    </form>
  );
}
