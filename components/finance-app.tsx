"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { PublicClientApplication } from "@azure/msal-browser";
import {
  configured,
  createAuth,
  publicConfig,
  request,
  storeSchema,
} from "../lib/client";
import {
  accountTypes,
  accountInput,
  balanceInput,
  monthInput,
  cashFlow,
  latestBalances,
  decimal,
  money,
  monthEnd,
  savingsRate,
  typeLabels,
  type Account,
  type Store,
} from "../shared/finance";

type Page = "dashboard" | "ledger" | "assets" | "accounts";
type Mutation = (path: string, body: unknown, method?: string) => Promise<void>;
const titles: Record<Page, [string, string]> = {
  dashboard: ["把生活过好，把账记清。", "收支有数，生活有度。一起看见家庭财务的每一步。"],
  ledger: [
    "每月记一次，心里更有数。",
    "按账户记录月度支出，按来源记录收入。空白表示尚未记录。",
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
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
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
function Brand() {
  return (
    <Link href="/" className="brand" aria-label="FinTracker 首页">
      <span className="brand-mark">
        <Icon name="wallet" size={23} />
      </span>
      <span>
        FinTracker<small>一起，积累好生活</small>
      </span>
    </Link>
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
              <Icon name={feature.icon} size={22} />
              <span>{feature.number}</span>
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
  const auth = useRef<PublicClientApplication | null>(null);
  const [signedIn, setSignedIn] = useState(false),
    [loading, setLoading] = useState(configured);
  const [store, setStore] = useState<Store | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7)),
    [owner, setOwner] = useState("ALL");
  const [modal, setModal] = useState<"account" | "income" | "balance" | null>(null),
    [editing, setEditing] = useState<Account | undefined>();
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const refresh = useCallback(async () => {
    if (!auth.current) throw new Error("登录尚未就绪");
    const response = await request(auth.current, "bootstrap");
    const raw: unknown = await response.json();
    setStore(storeSchema.parse(raw));
  }, []);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    const client = createAuth();
    auth.current = client;
    void (async () => {
      try {
        await client.initialize();
        const result = await client.handleRedirectPromise();
        const account = result?.account ?? client.getAllAccounts()[0];
        if (account) {
          client.setActiveAccount(account);
          if (active) setSignedIn(true);
          await refresh();
        }
      } catch (e) {
        if (active) setError(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);
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
      await request(auth.current, path, method, body);
      setDirty(false);
      setModal(null);
      setEditing(undefined);
      try {
        await refresh();
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
      const response = await request(auth.current, `export/${kind}`);
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
  const flow = store ? cashFlow(store, month, owner) : null;
  const annual = store ? cashFlow(store, month.slice(0, 4), owner) : null;
  const latest = store ? latestBalances(store, monthEnd(month), owner) : [];
  const assetTotal = latest.reduce((sum, b) => sum + BigInt(b.amountMinor), 0n);
  const period = store?.periods.find((p) => p.month === month);
  const complete = Boolean(period?.incomeComplete && period.expenseComplete);
  const recordedKinds = new Set(
    store?.entries
      .filter(
        (entry) =>
          entry.month === month &&
          (owner === "ALL" || (entry.ownerId ?? "SHARED") === owner),
      )
      .map((entry) => store.lines.find((line) => line.id === entry.lineId)?.kind),
  );
  const incomeRecorded = recordedKinds.has("INCOME") || Boolean(period?.incomeComplete);
  const expenseRecorded =
    recordedKinds.has("EXPENSE") || Boolean(period?.expenseComplete);
  const open = (value: "account" | "income" | "balance", account?: Account) => {
    if (guardNavigation()) {
      setEditing(account);
      setModal(value);
      setError("");
    }
  };
  return (
    <div className={`app-shell${signedIn ? "" : " guest-shell"}`}>
      {signedIn && (
        <aside className="sidebar">
          <Brand />
          <div className="space-label">家庭财务空间</div>
          <nav aria-label="主导航">
            {nav.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                onClick={(e) => {
                  if (!guardNavigation()) e.preventDefault();
                }}
              >
                <Icon name={item.icon} />
                {item.label}
                {page === item.id && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
        </aside>
      )}
      <div className="workspace">
        <header className="topbar">
          {signedIn ? (
            <span>
              <span className="status-dot" />
              私人数据 · 仅限家庭成员
            </span>
          ) : (
            <Brand />
          )}
          <div className="topbar-actions">
            {signedIn ? (
              <button
                className="text-button"
                onClick={() => {
                  if (guardNavigation())
                    void auth.current
                      ?.logoutRedirect()
                      .catch((e: unknown) => setError(message(e)));
                }}
              >
                退出登录
              </button>
            ) : (
              <button
                className="login-button"
                disabled={!configured || loading || busy}
                aria-busy={loading || busy}
                aria-label={busy ? "正在跳转…" : "Microsoft 登录"}
                title={busy ? "正在跳转…" : "Microsoft 登录"}
                onClick={() => void signIn()}
              >
                <Icon name="profile" size={22} />
              </button>
            )}
          </div>
        </header>
        <main className={signedIn ? undefined : "landing-main"}>
          {signedIn && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">YOUR HOME, YOUR FINANCES</div>
                <h1>{titles[page][0]}</h1>
                <p>{titles[page][1]}</p>
              </div>
              <button
                className="primary-button"
                disabled={!store || busy}
                onClick={() =>
                  page === "assets"
                    ? open("balance")
                    : page === "accounts"
                      ? open("account")
                      : open("income")
                }
              >
                <Icon name="plus" size={18} />
                {page === "assets"
                  ? "登记资产"
                  : page === "accounts"
                    ? "新增账户"
                    : "新增收入来源"}
              </button>
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
              <div className="filter-bar">
                <div className="segmented">
                  <span className="selected">月度视图</span>
                  <span className="filter-caption">CNY · 人民币</span>
                </div>
                <div className="filters">
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
                  <label>
                    <span className="sr-only">归属筛选</span>
                    <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                      <option value="ALL">全部家庭成员</option>
                      {store?.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="SHARED">共同账户</option>
                    </select>
                  </label>
                </div>
              </div>
              {page === "dashboard" && (
                <>
                  <div className="metrics">
                    <Metric
                      label="本月收入"
                      value={flow && incomeRecorded ? money(flow.income) : "—"}
                      note={period?.incomeComplete ? "本月收入已完成" : "收入尚未完成"}
                      icon="down"
                      tone="green"
                    />
                    <Metric
                      label="本月支出"
                      value={flow && expenseRecorded ? money(flow.expense) : "—"}
                      note={period?.expenseComplete ? "本月支出已完成" : "支出尚未完成"}
                      icon="up"
                      tone="orange"
                    />
                    <Metric
                      label={complete ? "本月结余" : "已记录差额"}
                      value={
                        flow && (incomeRecorded || expenseRecorded)
                          ? money(flow.savings)
                          : "—"
                      }
                      note={
                        flow
                          ? `储蓄率 ${savingsRate(flow.income, flow.expense, complete) ?? "暂不适用"}`
                          : "收入 − 支出"
                      }
                      icon="wallet"
                      tone="blue"
                    />
                    <Metric
                      label="资产总览"
                      value={store && latest.length ? money(assetTotal) : "—"}
                      note={
                        latest.length
                          ? `${latest.length} 个已登记资产 · 含历史估值`
                          : "按最近一次余额汇总"
                      }
                      icon="grid"
                      tone="purple"
                    />
                  </div>
                  {!complete && store && (
                    <p className="data-warning">
                      本月记录不完整，结余为已记录数据的差额；不能代表完整月度结余。
                    </p>
                  )}
                  {annual && (
                    <div className="annual-summary">
                      <span>{month.slice(0, 4)} 年已记录汇总</span>
                      <span>
                        收入 <strong>{money(annual.income)}</strong>
                      </span>
                      <span>
                        支出 <strong>{money(annual.expense)}</strong>
                      </span>
                      <span>
                        结余 <strong>{money(annual.savings)}</strong>
                      </span>
                      <small>含未完成月份，非全年最终数值</small>
                    </div>
                  )}
                  <div className="dashboard-grid">
                    <section className="panel trend-panel">
                      <PanelTitle
                        title="收支趋势"
                        subtitle="每月回顾，看见生活的节奏"
                        right={
                          <div className="legend">
                            <i className="green" />
                            收入 <i className="orange" />
                            支出
                          </div>
                        }
                      />
                      {store && store.entries.length ? (
                        <Trend store={store} year={month.slice(0, 4)} owner={owner} />
                      ) : (
                        <Empty
                          title="等你记下第一个月"
                          text="收入与支出会在这里汇成清晰的趋势。"
                        />
                      )}
                      <div className="panel-footer">
                        只展示已录入数据；未完成月份会标注。
                        <Link href="/ledger/">
                          开始月度记账 <Icon name="arrow" size={16} />
                        </Link>
                      </div>
                    </section>
                    <section className="panel">
                      <PanelTitle title="资产分布" subtitle="看见每一份积累" />
                      {store && latest.length ? (
                        <Composition store={store} asOf={monthEnd(month)} owner={owner} />
                      ) : (
                        <Empty
                          title="你的积累，从这里开始"
                          text="登记账户余额，查看资产组成。"
                        />
                      )}
                      <div className="panel-footer">
                        <span>金融资产、房产及车辆</span>
                        <Link href="/assets/">
                          查看 <Icon name="arrow" size={16} />
                        </Link>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <PanelTitle
                      title="本月账户支出"
                      subtitle="个人与共同账户，一目了然"
                      right={
                        <Link className="subtle-link" href="/ledger/">
                          查看全部 <Icon name="arrow" size={16} />
                        </Link>
                      }
                    />
                    {store ? (
                      <Spending store={store} month={month} owner={owner} />
                    ) : (
                      <Empty
                        title="还没有可显示的记录"
                        text="登录后，真实的账户月度支出会显示在这里。"
                      />
                    )}
                  </section>
                </>
              )}
              {page === "ledger" &&
                (store ? (
                  <Ledger
                    key={`${month}:${period?.version ?? 0}`}
                    store={store}
                    month={month}
                    owner={owner}
                    mutate={mutate}
                    busy={busy}
                    onDirty={setDirty}
                    onAddAccount={() => open("account")}
                    onAddIncome={() => open("income")}
                  />
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
                    owner={owner}
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
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: string;
}) {
  return (
    <section className={`metric ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon name={icon} />
        </span>
      </div>
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
function Trend({ store, year, owner }: { store: Store; year: string; owner: string }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const period = store.periods.find((p) => p.month === month);
    return { month, ...cashFlow(store, month, owner), period };
  });
  const max = Math.max(
    1,
    ...points.flatMap((p) => [Number(p.income), Number(p.expense)]).map(Math.abs),
  );
  return (
    <>
      <div className="chart" aria-label={`${year} 年收支趋势`}>
        {points.map((p, i) => (
          <div
            key={p.month}
            className="chart-column"
            title={`${p.month} 收入 ${money(p.income)}，支出 ${money(p.expense)}${!p.period?.incomeComplete || !p.period.expenseComplete ? "（未完成）" : ""}`}
          >
            <div className="chart-bars">
              {p.period ? (
                <>
                  <span
                    className="income-bar"
                    style={{
                      height: `${Math.max(2, (Math.abs(Number(p.income)) / max) * 100)}%`,
                    }}
                  />
                  <span
                    className="expense-bar"
                    style={{
                      height: `${Math.max(2, (Math.abs(Number(p.expense)) / max) * 100)}%`,
                    }}
                  />
                </>
              ) : (
                <span className="missing-bar" />
              )}
            </div>
            <span>
              {i + 1}月
              {p.period && (!p.period.incomeComplete || !p.period.expenseComplete)
                ? "*"
                : ""}
            </span>
          </div>
        ))}
      </div>
      <details className="chart-data">
        <summary>查看准确数值</summary>
        <table>
          <thead>
            <tr>
              <th>月份</th>
              <th>收入</th>
              <th>支出</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <td>{p.month}</td>
                <td>{p.period ? money(p.income) : "未记录"}</td>
                <td>{p.period ? money(p.expense) : "未记录"}</td>
                <td>
                  {p.period?.incomeComplete && p.period.expenseComplete
                    ? "完整"
                    : "未完成"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    colors = ["#237d65", "#76b7a5", "#dfa161", "#7f90c2", "#d3b1d4", "#a4b592"];
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
        style={{ background: sum > 0n ? `conic-gradient(${stops})` : "#edf2ee" }}
        role="img"
        aria-label="资产类型分布"
      >
        <div>
          <small>资产总额</small>
          <strong>{money(sum)}</strong>
          <span>{balances.length} 个资产</span>
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
function Spending({
  store,
  month,
  owner,
}: {
  store: Store;
  month: string;
  owner: string;
}) {
  const lines = new Map(store.lines.map((l) => [l.id, l]));
  const rows = store.entries.filter(
    (e) =>
      e.month === month &&
      lines.get(e.lineId)?.kind === "EXPENSE" &&
      (owner === "ALL" || (e.ownerId ?? "SHARED") === owner),
  );
  if (!rows.length)
    return (
      <Empty title="这个月还没有支出记录" text="录入账户月度支出，查看个人与共同开销。" />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>账户</th>
            <th>归属</th>
            <th className="numeric">月度支出</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <span className="row-icon">
                  <Icon name="wallet" size={17} />
                </span>
                {lines.get(e.lineId)!.name}
              </td>
              <td>
                <span className="owner-tag">{ownerName(store, e.ownerId)}</span>
              </td>
              <td className="numeric">{money(e.amountMinor)}</td>
              <td className="muted">{e.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
}: {
  store: Store;
  month: string;
  owner: string;
  mutate: Mutation;
  busy: boolean;
  onDirty: (value: boolean) => void;
  onAddAccount: () => void;
  onAddIncome: () => void;
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
              <button
                type="button"
                className="subtle-link"
                onClick={kind === "INCOME" ? onAddIncome : onAddAccount}
              >
                <Icon name="plus" size={16} />
                新增{kind === "INCOME" ? "来源" : "账户"}
              </button>
            }
          />
          <div className="table-scroll">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>{kind === "INCOME" ? "收入来源" : "账户"}</th>
                  <th>归属</th>
                  <th>金额 (CNY)</th>
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
                      </td>
                      <td>
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
                disabled={owner !== "ALL"}
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
      <div className="save-bar">
        <span>保存不会修改任何资产余额。</span>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "保存中…" : "保存本月记录"}
        </button>
      </div>
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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
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
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
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
