"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { configured, publicConfig } from "../lib/client";
import {
  copy,
  formatMonthShort,
  formatOwnerName,
  getAccountTypeLabel,
  translateValidationMessage,
  type Locale,
} from "../lib/i18n";
import { useFinanceSession } from "./finance-session";
import { LoadingBanner, WorkspaceSkeleton } from "./loading-state";
import { DisplayControls, usePreferences } from "./preferences";
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
  type Account,
  type Store,
} from "../shared/finance";

type Page = "dashboard" | "ledger" | "assets" | "accounts";
type Mutation = (path: string, body: unknown, method?: string) => Promise<void>;
const navItems: { id: Page; href: string; icon: string }[] = [
  { id: "dashboard", href: "/", icon: "grid" },
  { id: "ledger", href: "/ledger/", icon: "book" },
  { id: "assets", href: "/assets/", icon: "wallet" },
  { id: "accounts", href: "/accounts/", icon: "settings" },
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
function Brand({ access, compact = false }: { access: ReactNode; compact?: boolean }) {
  const { t } = usePreferences();
  return (
    <div className="brand">
      {access}
      {!compact && (
        <Link href="/" className="brand-name" aria-label={t.brand.homeAriaLabel}>
          FinTracker<small>{t.brand.tagline}</small>
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
  const { t } = usePreferences();
  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <div className="landing-kicker">
            <span className="status-dot" />
            {t.landing.kicker}
          </div>
          <h1 id="landing-title">
            {t.landing.titleLine1}
            <br />
            <em>{t.landing.titleLine2}</em>
          </h1>
          <p className="landing-description">
            {t.landing.descriptionLines[0]}
            <br />
            {t.landing.descriptionLines[1]}
            <br />
            {t.landing.descriptionLines[2]}
          </p>
        </div>
        <div className="landing-visual" aria-hidden="true">
          <div className="landing-orbit" />
          <div className="landing-notebook">
            <div className="notebook-heading">
              <Icon name="home" size={21} />
              <span>{t.landing.notebookHeading}</span>
            </div>
            <div className="notebook-title">
              {t.landing.notebookTitleLine1}
              <br />
              {t.landing.notebookTitleLine2}
            </div>
            <div className="notebook-rule" />
            <div className="notebook-chart">
              <span>{t.landing.notebookChartCaption}</span>
              <svg viewBox="0 0 280 105" fill="none">
                <path className="notebook-chart-grid" d="M0 25h280M0 60h280M0 95h280" />
                <path
                  className="notebook-chart-line"
                  d="M4 88C28 88 24 65 49 69S80 82 103 58s35 5 58-17 29 1 51-15 36-5 64-21"
                />
              </svg>
            </div>
            <div className="notebook-bottom">
              <span>{t.landing.notebookBottom}</span>
              <Icon name="home" size={17} />
            </div>
          </div>
          <div className="landing-label label-income">
            <span>
              <Icon name="book" size={20} />
            </span>
            {t.landing.labelIncome}
          </div>
          <div className="landing-label label-home">
            <span>
              <Icon name="home" size={20} />
            </span>
            {t.landing.labelHome}
          </div>
        </div>
      </section>
      <section
        className="landing-features"
        id="landing-features"
        aria-label={t.landing.featuresAriaLabel}
      >
        {t.landing.features.map((feature) => (
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
          <p>{t.landing.setupNotice}</p>
          <a
            href="https://github.com/MuyangAmigo/FinTracker#deployment"
            target="_blank"
            rel="noreferrer"
          >
            {t.landing.setupGuide} <Icon name="arrow" size={14} />
          </a>
        </div>
      )}
      <DisplayControls variant="landing" />
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
function message(error: unknown, locale: Locale) {
  return error instanceof Error
    ? translateValidationMessage(error.message, locale)
    : copy[locale].auth.genericError;
}

export function FinanceApp({ page }: { page: Page }) {
  const { locale, t } = usePreferences();
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
  const guardNavigation = () => !dirty || window.confirm(t.common.unsavedConfirm);
  const mutate: Mutation = async (path, body, method = "POST") => {
    if (!auth.current) throw new Error(t.auth.signInFirst);
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
        throw new Error(t.common.savedReloadError(message(e, locale)));
      }
      setNotice(t.common.saved);
    } catch (e) {
      setError(message(e, locale));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  async function signIn() {
    if (!auth.current) {
      setError(t.auth.notReadyRetry);
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
      setError(message(e, locale));
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
      setError(message(e, locale));
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
        aria-label={t.year.previous}
        disabled={busy || Number(year) === 0}
        onClick={() => setYear(String(Number(year) - 1).padStart(4, "0"))}
      >
        {t.year.previous}
      </button>
      <label>
        <span className="sr-only">{t.year.label}</span>
        <select value={year} disabled={busy} onChange={(e) => setYear(e.target.value)}>
          {years.map((value) => (
            <option key={value} value={value}>
              {t.year.option(value)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="text-button"
        aria-label={t.year.next}
        disabled={busy || Number(year) === 9999}
        onClick={() => setYear(String(Number(year) + 1).padStart(4, "0"))}
      >
        {t.year.next}
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
      className={`app-shell${signedIn ? " finance-shell" : " guest-shell"}${signedIn && collapsed ? " sidebar-collapsed" : ""}`}
    >
      {signedIn && (
        <aside className="sidebar">
          <div className="brand-access">
            <Brand
              compact={collapsed}
              access={
                <button
                  className="login-button"
                  aria-label={t.nav.signOut}
                  title={t.nav.signOut}
                  onClick={() => {
                    if (guardNavigation())
                      void signOut().catch((e: unknown) => setError(message(e, locale)));
                  }}
                >
                  <Avatar />
                </button>
              }
            />
          </div>
          <div className="space-label">{t.nav.spaceLabel}</div>
          <nav aria-label={t.nav.ariaLabel}>
            {navItems.map((item) => {
              const label = t.nav[item.id];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  aria-current={page === item.id ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  onClick={(e) => {
                    if (!guardNavigation()) e.preventDefault();
                  }}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{label}</span>
                  {page === item.id && <span className="nav-dot" />}
                </Link>
              );
            })}
          </nav>
          <DisplayControls variant="sidebar" compact={collapsed} />
          <button
            className="sidebar-toggle"
            aria-label={collapsed ? t.nav.expand : t.nav.collapse}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Icon name="arrow" size={18} />
            <span>{collapsed ? t.nav.expandShort : t.nav.collapse}</span>
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
                    aria-label={busy ? t.auth.redirecting : t.auth.signIn}
                    title={busy ? t.auth.redirecting : t.auth.signIn}
                    onClick={() => void signIn()}
                  >
                    <Avatar />
                  </button>
                }
              />
            </div>
          </header>
        )}
        <main className={signedIn ? "finance-main" : "landing-main"}>
          {signedIn && (
            <div className="page-heading">
              <div>
                <h1>{t.pages[page][0]}</h1>
                <p>{t.pages[page][1]}</p>
              </div>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="text-button"
                disabled={loading || (!signedIn && (!configured || busy))}
                onClick={() =>
                  signedIn
                    ? void refresh().catch((e: unknown) => setError(message(e, locale)))
                    : void signIn()
                }
              >
                {signedIn ? t.auth.reload : t.auth.retrySignIn}
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {loading && (
            <LoadingBanner
              title={t.loading.loadingRecords}
              detail={signedIn ? t.loading.loadingDetail : undefined}
              compact={!signedIn}
            />
          )}
          {!loading && signedIn && busy && Boolean(store) && !modal && !ledgerMode && (
            <LoadingBanner title={t.loading.syncingRecords} compact />
          )}
          {!signedIn ? (
            <Landing />
          ) : (
            <div
              className="workspace-content"
              aria-busy={loading || (busy && !modal && !ledgerMode)}
            >
              {loading && !store ? (
                <WorkspaceSkeleton page={page} />
              ) : (
                <>
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
                        <Empty
                          title={t.empty.dashboardTitle}
                          text={t.empty.dashboardText}
                        />
                      </section>
                    ))}
                  {page === "ledger" &&
                    (store ? (
                      <>
                        <section
                          className="ledger-summary"
                          aria-label={t.ledger.summaryAriaLabel(year)}
                        >
                          <div className="section-heading">
                            <div>
                              <h2>{t.ledger.summaryHeading}</h2>
                              <p>{t.ledger.summarySubtitle}</p>
                            </div>
                            {yearControl}
                          </div>
                          <AnnualMetrics store={store} year={year} />
                        </section>
                        <MonthlyRecords
                          store={store}
                          year={year}
                          onOpen={selectMonth}
                          busy={busy}
                        />
                      </>
                    ) : (
                      <section className="panel">
                        <Empty title={t.empty.ledgerTitle} text={t.empty.ledgerText} />
                      </section>
                    ))}
                  {page === "assets" &&
                    (store ? (
                      <Assets
                        store={store}
                        month={month}
                        owner="ALL"
                        onRecord={() => open("balance")}
                        busy={busy}
                        onMonthChange={(value) => {
                          if (value && guardNavigation()) {
                            setMonth(value);
                            setDirty(false);
                          }
                        }}
                      />
                    ) : (
                      <section className="panel">
                        <Empty title={t.empty.assetsTitle} text={t.empty.assetsText} />
                      </section>
                    ))}
                  {page === "accounts" &&
                    (store ? (
                      <Accounts
                        store={store}
                        onEdit={(a) => open("account", a)}
                        onAdd={() => open("account")}
                        onIncome={() => open("income")}
                        busy={busy}
                      />
                    ) : (
                      <section className="panel">
                        <Empty
                          title={t.empty.accountsTitle}
                          text={t.empty.accountsText}
                        />
                      </section>
                    ))}
                  {store && (
                    <div className="export-bar">
                      <span>{t.exportBar.caption}</span>
                      <button onClick={() => void download("monthly")}>
                        {t.exportBar.monthly}
                      </button>
                      <button onClick={() => void download("assets")}>
                        {t.exportBar.assets}
                      </button>
                      <button onClick={() => void download("backup")}>
                        {t.exportBar.backup}
                      </button>
                    </div>
                  )}
                  {ledgerMode && !modal && store && (
                    <Modal
                      title={
                        ledgerMode === "view"
                          ? t.ledger.modalViewTitle(month)
                          : t.ledger.modalEditTitle(month)
                      }
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
            </div>
          )}
        </main>
      </div>
      {modal && store && (
        <Modal
          title={
            modal === "balance"
              ? t.modals.recordBalance
              : modal === "income"
                ? t.modals.addIncome
                : editing
                  ? t.modals.editAccount
                  : t.modals.addAccount
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
  const { t } = usePreferences();
  const annual = annualSummary(store, year);
  return (
    <div className="metrics">
      <Metric
        label={t.metrics.totalIncome}
        value={annual.incomeRecorded ? money(annual.income) : "—"}
        note={t.metrics.totalIncomeNote}
      />
      <Metric
        label={t.metrics.totalExpense}
        value={annual.expenseRecorded ? money(annual.expense) : "—"}
        note={t.metrics.totalExpenseNote}
      />
      <Metric
        label={t.metrics.totalSavings}
        value={
          annual.incomeRecorded || annual.expenseRecorded ? money(annual.savings) : "—"
        }
        note={
          annual.recordedMonths > annual.completeMonths
            ? t.metrics.totalSavingsPartialNote
            : t.metrics.totalSavingsCompleteNote
        }
        emphasis
      />
      <Metric
        label={t.metrics.savingsRate}
        value={annual.rate ?? t.metrics.savingsRateNa}
        note={t.metrics.savingsRateNote}
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
  const { t } = usePreferences();
  const balances = latestBalances(store, asOf);
  const total = balances.reduce((sum, balance) => sum + BigInt(balance.amountMinor), 0n);
  const annual = annualSummary(store, year);
  return (
    <div className="annual-dashboard">
      <section className="annual-section" aria-labelledby="income-section">
        <div className="section-heading">
          <h2 id="income-section">{t.dashboard.cashFlowHeading}</h2>
          {yearControl}
        </div>
        <div className="overview-hero">
          <section className="panel hero-chart">
            <PanelTitle
              title={t.dashboard.trendTitle}
              subtitle={t.dashboard.trendSubtitle}
              right={
                <div className="legend">
                  <i className="income-key" />
                  {t.dashboard.legendIncome}
                  <i className="expense-key" />
                  {t.dashboard.legendExpense}
                </div>
              }
            />
            <Trend store={store} year={year} />
          </section>
          <aside
            className="annual-figures"
            aria-label={t.dashboard.annualAriaLabel(year)}
          >
            <h2>{t.dashboard.annualHeading}</h2>
            <p className="summary-context">
              {t.dashboard.annualContext(annual.recordedMonths, annual.completeMonths)}
            </p>
            <AnnualMetrics store={store} year={year} />
          </aside>
        </div>
      </section>
      <section className="annual-section" aria-labelledby="asset-section">
        <div className="section-heading">
          <h2 id="asset-section">{t.dashboard.assetsHeading}</h2>
          <p>{t.dashboard.assetsAsOf(asOf)}</p>
        </div>
        <div className="asset-overview">
          <div className="asset-summary">
            <div>
              <small>{t.dashboard.totalAssets}</small>
              <strong>{balances.length ? money(total) : "—"}</strong>
              <span>{t.dashboard.totalAssetsNote(balances.length)}</span>
            </div>
          </div>
          <section className="panel asset-distribution">
            <PanelTitle
              title={t.dashboard.distributionTitle}
              subtitle={t.dashboard.distributionSubtitle}
            />
            {balances.length ? (
              <Composition store={store} asOf={asOf} owner="ALL" />
            ) : (
              <Empty title={t.dashboard.noAssetsTitle} text={t.dashboard.noAssetsText} />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
type MonthlyProps = {
  store: Store;
  year: string;
  onOpen: (month: string, mode: "view" | "edit") => void;
  busy: boolean;
};
function CompletionStatus({
  complete,
  recorded,
}: {
  complete: boolean;
  recorded: boolean;
}) {
  const { t } = usePreferences();
  return (
    <span
      className={`record-state ${complete ? "is-complete" : recorded ? "is-partial" : "is-missing"}`}
    >
      {complete
        ? t.common.complete
        : recorded
          ? t.common.incomplete
          : t.common.unrecorded}
    </span>
  );
}
function MonthActions({
  month,
  onOpen,
  busy,
}: Pick<MonthlyProps, "onOpen" | "busy"> & { month: string }) {
  const { t } = usePreferences();
  return (
    <div className="row-actions">
      <button
        type="button"
        className="text-button"
        aria-label={t.ledger.viewMonthAria(month)}
        disabled={busy}
        onClick={() => onOpen(month, "view")}
      >
        {t.ledger.view}
      </button>
      <button
        type="button"
        className="text-button"
        aria-label={t.ledger.editMonthAria(month)}
        disabled={busy}
        onClick={() => onOpen(month, "edit")}
      >
        {t.ledger.edit}
      </button>
    </div>
  );
}
function MonthlyRecords(props: MonthlyProps) {
  const { t } = usePreferences();
  const [view, setView] = useState<"board" | "table">("board");
  return (
    <section className="monthly-workspace" aria-labelledby="monthly-title">
      <div className="section-heading">
        <div>
          <h2 id="monthly-title">{t.ledger.monthlyHeading}</h2>
          <p>{t.ledger.monthlySubtitle}</p>
        </div>
        <div
          className="view-switch"
          role="group"
          aria-label={t.ledger.viewSwitchAriaLabel}
        >
          <button
            type="button"
            aria-pressed={view === "board"}
            disabled={props.busy}
            onClick={() => setView("board")}
          >
            {t.ledger.boardView}
          </button>
          <button
            type="button"
            aria-pressed={view === "table"}
            disabled={props.busy}
            onClick={() => setView("table")}
          >
            {t.ledger.tableView}
          </button>
        </div>
      </div>
      {view === "board" ? <MonthlyBoard {...props} /> : <MonthlyTable {...props} />}
    </section>
  );
}
function MonthlyBoard({ store, year, onOpen, busy }: MonthlyProps) {
  const { t } = usePreferences();
  const rows = annualSummary(store, year).months.toReversed();
  const periods = new Map(store.periods.map((period) => [period.month, period]));
  const groups = [
    {
      id: "missing",
      title: t.ledger.colMissing,
      rows: rows.filter((row) => !row.recorded),
    },
    {
      id: "partial",
      title: t.ledger.colPartial,
      rows: rows.filter((row) => row.recorded && !row.complete),
    },
    {
      id: "complete",
      title: t.ledger.colComplete,
      rows: rows.filter((row) => row.complete),
    },
  ];
  return (
    <>
      <div
        className="board-scroll"
        role="region"
        aria-label={t.ledger.boardRegionAria(year)}
        tabIndex={0}
      >
        <div className="monthly-board">
          {groups.map((group) => (
            <section
              className={`month-column month-column-${group.id}`}
              key={group.id}
              aria-labelledby={`months-${group.id}`}
            >
              <header className="month-column-heading">
                <h3 id={`months-${group.id}`}>{group.title}</h3>
                <span
                  className="section-count"
                  aria-label={t.ledger.monthsCountAria(group.rows.length)}
                >
                  {group.rows.length}
                </span>
              </header>
              <div className="month-column-items">
                {group.rows.map((row) => (
                  <article
                    className="month-card"
                    aria-label={t.ledger.monthCardAria(row.month)}
                    key={row.month}
                  >
                    <h4>{row.month}</h4>
                    <dl className="month-values">
                      <div>
                        <dt>{t.ledger.income}</dt>
                        <dd>
                          {row.incomeRecorded ? money(row.income) : t.common.unrecorded}
                        </dd>
                      </div>
                      <div>
                        <dt>{t.ledger.expense}</dt>
                        <dd>
                          {row.expenseRecorded ? money(row.expense) : t.common.unrecorded}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {t.ledger.savings}
                          {row.recorded && !row.complete ? " *" : ""}
                        </dt>
                        <dd>
                          {row.incomeRecorded || row.expenseRecorded
                            ? money(row.savings)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>{t.ledger.savingsRate}</dt>
                        <dd>{row.rate ?? "—"}</dd>
                      </div>
                    </dl>
                    <div className="month-completeness">
                      <span>
                        {t.ledger.income}{" "}
                        <CompletionStatus
                          complete={periods.get(row.month)?.incomeComplete ?? false}
                          recorded={row.recorded}
                        />
                      </span>
                      <span>
                        {t.ledger.expense}{" "}
                        <CompletionStatus
                          complete={periods.get(row.month)?.expenseComplete ?? false}
                          recorded={row.recorded}
                        />
                      </span>
                    </div>
                    {row.recorded && !row.complete && (
                      <p className="month-partial-note">{t.ledger.partialSavingsNote}</p>
                    )}
                    <MonthActions month={row.month} onOpen={onOpen} busy={busy} />
                  </article>
                ))}
                {!group.rows.length && (
                  <p className="month-column-empty">{t.ledger.emptyColumn}</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <p className="board-scroll-hint">{t.ledger.boardScrollHint}</p>
    </>
  );
}
function MonthlyTable({ store, year, onOpen, busy }: MonthlyProps) {
  const { t } = usePreferences();
  const rows = annualSummary(store, year).months.toReversed();
  return (
    <section className="panel">
      <PanelTitle title={t.ledger.tableTitle(year)} subtitle={t.ledger.tableSubtitle} />
      <div
        className="table-scroll"
        role="region"
        aria-label={t.ledger.tableRegionAria}
        tabIndex={0}
      >
        <table aria-label={t.ledger.tableTitle(year)}>
          <thead>
            <tr>
              <th>{t.ledger.colMonth}</th>
              <th className="numeric">{t.ledger.income}</th>
              <th className="numeric">{t.ledger.expense}</th>
              <th className="numeric">{t.ledger.savings}</th>
              <th className="numeric">{t.ledger.savingsRate}</th>
              <th>{t.ledger.colIncomeStatus}</th>
              <th>{t.ledger.colExpenseStatus}</th>
              <th>{t.ledger.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td className="numeric">
                  {row.incomeRecorded ? money(row.income) : t.common.unrecorded}
                </td>
                <td className="numeric">
                  {row.expenseRecorded ? money(row.expense) : t.common.unrecorded}
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
                      <CompletionStatus
                        complete={period?.[kind] ?? false}
                        recorded={row.recorded}
                      />
                    </td>
                  );
                })}
                <td>
                  <MonthActions month={row.month} onOpen={onOpen} busy={busy} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-footer">{t.ledger.tableFooter}</div>
    </section>
  );
}
function Trend({ store, year }: { store: Store; year: string }) {
  const { locale, t } = usePreferences();
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
        aria-label={t.trend.scrollAriaLabel}
        tabIndex={0}
      >
        <div className="trend-chart">
          <div className="chart-axis" aria-hidden="true">
            <span>{scaleMinor > 0n ? money(scaleMinor) : ""}</span>
            <span>{scaleMinor > 0n ? money(scaleMinor / 2n) : ""}</span>
            <span>{recorded ? money(0n) : "—"}</span>
          </div>
          <div className="chart" role="img" aria-label={t.trend.chartAriaLabel(year)}>
            {points.map((p, i) => (
              <div
                key={p.month}
                className="chart-column"
                title={t.trend.columnTitle(
                  p.month,
                  p.incomeRecorded ? money(p.income) : t.common.unrecorded,
                  p.expenseRecorded ? money(p.expense) : t.common.unrecorded,
                  p.recorded && !p.complete,
                )}
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
                  {formatMonthShort(i, locale)}
                  {p.recorded && !p.complete ? "*" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="chart-scroll-hint">{t.trend.scrollHint}</p>
      <details className="chart-data">
        <summary>{t.trend.exactSummary}</summary>
        <div className="disclosure-content">
          <div className="table-scroll">
            <table aria-label={t.trend.exactTableAriaLabel(year)}>
              <thead>
                <tr>
                  <th>{t.trend.colMonth}</th>
                  <th className="numeric">{t.trend.colIncome}</th>
                  <th className="numeric">{t.trend.colExpense}</th>
                  <th>{t.trend.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.month}>
                    <td>{p.month}</td>
                    <td className="numeric">
                      {p.incomeRecorded ? money(p.income) : t.common.unrecorded}
                    </td>
                    <td className="numeric">
                      {p.expenseRecorded ? money(p.expense) : t.common.unrecorded}
                    </td>
                    <td>
                      {!p.recorded
                        ? t.common.unrecorded
                        : p.complete
                          ? t.common.complete
                          : t.common.incomplete}
                    </td>
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
  const { locale, t } = usePreferences();
  const balances = latestBalances(store, asOf, owner),
    values = new Map<string, bigint>();
  for (const b of balances) {
    const type = store.accounts.find((a) => a.id === b.accountId)!.type;
    values.set(type, (values.get(type) ?? 0n) + BigInt(b.amountMinor));
  }
  const sum = [...values.values()].reduce((a, b) => a + b, 0n),
    colors = [
      "var(--chart-category-1)",
      "var(--chart-category-2)",
      "var(--chart-category-3)",
      "var(--chart-category-4)",
      "var(--chart-category-5)",
      "var(--chart-category-6)",
    ];
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
        aria-label={t.dashboard.donutAriaLabel}
      >
        <div>
          <small>{t.dashboard.donutSmall}</small>
          <strong>{balances.length}</strong>
          <span>{t.dashboard.donutUnit(balances.length)}</span>
        </div>
      </div>
      <div className="composition-list">
        {segments.map((s) => (
          <div key={s.type}>
            <span>
              <i style={{ background: s.color }} />
              {getAccountTypeLabel(s.type as Account["type"], locale)}
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
  const { locale, t } = usePreferences();
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
        !window.confirm(t.ledger.clearConfirm)
      )
        return;
      await mutate(`months/${month}`, payload, "PUT");
    } catch (e) {
      setError(message(e, locale));
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
            title={
              kind === "INCOME" ? t.ledger.incomePanelTitle : t.ledger.expensePanelTitle
            }
            subtitle={
              kind === "INCOME"
                ? t.ledger.incomePanelSubtitle
                : t.ledger.expensePanelSubtitle
            }
            right={
              !readOnly && (
                <button
                  type="button"
                  className="subtle-link"
                  onClick={kind === "INCOME" ? onAddIncome : onAddAccount}
                >
                  <Icon name="plus" size={16} />
                  {kind === "INCOME" ? t.ledger.addSource : t.ledger.addAccount}
                </button>
              )
            }
          />
          <div className="table-scroll">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>
                    {kind === "INCOME" ? t.ledger.colIncomeSource : t.ledger.colAccount}
                  </th>
                  <th>{t.ledger.colOwner}</th>
                  <th>{t.ledger.colAmount}</th>
                  <th>{t.ledger.colNote}</th>
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
                        {line.archived && <small>{t.common.archivedSuffix}</small>}
                      </td>
                      <td>
                        <span className="owner-tag">
                          {formatOwnerName(store, recordedOwner(line), locale)}
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
                            t.common.unrecorded
                          )
                        ) : (
                          <input
                            aria-label={t.ledger.amountAria(line.name)}
                            inputMode="decimal"
                            placeholder={t.ledger.amountPlaceholder}
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
                            aria-label={t.ledger.noteAria(line.name)}
                            maxLength={500}
                            placeholder={t.common.optional}
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
            <Empty title={t.ledger.emptyRowTitle} text={t.ledger.emptyRowText} />
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
                ? t.ledger.incomeCompleteLabel
                : t.ledger.expenseCompleteLabel}
            </label>
            <span>{t.ledger.blankNotZero}</span>
          </div>
        </section>
      ))}
      {!readOnly && (
        <div className="save-bar">
          <span>{t.ledger.saveBarNote}</span>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy && <span className="button-spinner" aria-hidden="true" />}
            {busy ? t.common.saving : t.ledger.saveMonthButton}
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
  onMonthChange,
  busy,
}: {
  store: Store;
  month: string;
  owner: string;
  onRecord: () => void;
  onMonthChange: (month: string) => void;
  busy: boolean;
}) {
  const { locale, t } = usePreferences();
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
    <div className="asset-bands">
      <section
        className="asset-summary asset-band"
        aria-label={t.assets.summaryAriaLabel}
      >
        <div>
          <small>{t.assets.latestKnownAsOf(month)}</small>
          <strong>{balances.length ? money(total) : "—"}</strong>
          <span>{t.assets.summaryNote}</span>
        </div>
        <div className="asset-period-actions">
          <label className="period-control">
            <span>{t.assets.valuationMonth}</span>
            <input
              aria-label={t.assets.recordMonthAria}
              type="month"
              value={month}
              disabled={busy}
              onChange={(e) => onMonthChange(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy} onClick={onRecord}>
            <Icon name="plus" size={18} />
            {t.assets.recordNewBalances}
          </button>
        </div>
      </section>
      <section className="panel asset-band" aria-label={t.assets.accountsPanelTitle}>
        <PanelTitle
          title={t.assets.accountsPanelTitle}
          subtitle={t.assets.accountsPanelSubtitle}
        />
        <p className="table-scroll-hint">{t.assets.tableScrollHint}</p>
        <div
          className="table-scroll"
          role="region"
          aria-label={t.assets.balancesRegionAria}
          tabIndex={0}
        >
          <table className="asset-balance-table" aria-label={t.assets.balancesTableAria}>
            <thead>
              <tr>
                <th>{t.assets.colAssetAccount}</th>
                <th>{t.assets.colType}</th>
                <th>{t.assets.colOwner}</th>
                <th className="numeric">{t.assets.colLatestBalance}</th>
                <th>{t.assets.colValuationDate}</th>
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map((a) => {
                const b = balances.find((v) => v.accountId === a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      {a.archived && <small>{t.common.archivedSuffix}</small>}
                    </td>
                    <td>{getAccountTypeLabel(a.type, locale)}</td>
                    <td>
                      <span className="owner-tag">
                        {formatOwnerName(store, b ? b.ownerId : a.ownerId, locale)}
                      </span>
                    </td>
                    <td className="numeric">
                      {b ? money(b.amountMinor) : t.common.unknown}
                    </td>
                    <td>
                      {b ? (
                        <>
                          {b.precision === "MONTH" ? b.asOf.slice(0, 7) : b.asOf}
                          {b.asOf.slice(0, 7) !== month && (
                            <span className="old-balance">{t.assets.priorValuation}</span>
                          )}
                        </>
                      ) : (
                        t.common.notRecordedYet
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleAccounts.length && (
          <Empty title={t.assets.noAccountsTitle} text={t.assets.noAccountsText} />
        )}
      </section>
      <section
        className="asset-band asset-history-band"
        aria-label={t.assets.historyBandAria}
      >
        <section className="panel history-panel">
          <PanelTitle title={t.assets.historyTitle} subtitle={t.assets.historySubtitle} />
          <div
            className="table-scroll"
            role="region"
            aria-label={t.assets.historyRegionAria}
            tabIndex={0}
          >
            <table aria-label={t.assets.historyTableAria}>
              <thead>
                <tr>
                  <th>{t.assets.colDate}</th>
                  <th>{t.assets.colAccount}</th>
                  <th>{t.assets.colOwner}</th>
                  <th className="numeric">{t.assets.colBalance}</th>
                  <th>{t.assets.colNote}</th>
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
                      <td>{formatOwnerName(store, b.ownerId, locale)}</td>
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
            <summary>{t.assets.referencesSummary}</summary>
            <div className="disclosure-content">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t.assets.colPeriod}</th>
                      <th>{t.assets.colRefKind}</th>
                      <th>{t.assets.colOwner}</th>
                      <th>{t.assets.colSourceValue}</th>
                      <th>{t.assets.colSourceNote}</th>
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
                          <td>{formatOwnerName(store, r.ownerId, locale)}</td>
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
      </section>
    </div>
  );
}
function Accounts({
  store,
  onEdit,
  onAdd,
  onIncome,
  busy,
}: {
  store: Store;
  onEdit: (a: Account) => void;
  onAdd: () => void;
  onIncome: () => void;
  busy: boolean;
}) {
  const { locale, t } = usePreferences();
  const sources = store.lines.filter((line) => line.kind === "INCOME");
  return (
    <div className="account-layout">
      <aside className="account-actions" aria-label={t.accounts.actionsAriaLabel}>
        <h2>{t.accounts.manageHeading}</h2>
        <p>{t.accounts.manageDescription}</p>
        <button className="primary-button" disabled={busy} onClick={onAdd}>
          <Icon name="plus" size={18} />
          {t.accounts.addAccount}
        </button>
        <button className="secondary-button" disabled={busy} onClick={onIncome}>
          {t.accounts.addIncomeSource}
        </button>
        <div className="account-guidance">
          <h3>{t.accounts.guidanceHeading}</h3>
          <p>{t.accounts.guidanceText}</p>
        </div>
      </aside>
      <div className="accounts-main">
        <section className="panel">
          <PanelTitle
            title={t.accounts.accountsPanelTitle}
            subtitle={t.accounts.accountsPanelSubtitle}
            right={
              <span className="section-count">
                {t.accounts.accountCount(store.accounts.length)}
              </span>
            }
          />
          <div className="account-list">
            {store.accounts.map((a) => (
              <button
                type="button"
                key={a.id}
                className={`account-row${a.archived ? " archived" : ""}`}
                aria-label={t.accounts.editAccountAria(a.name)}
                disabled={busy}
                onClick={() => onEdit(a)}
              >
                <span className="account-identity">
                  <Icon name="wallet" size={20} />
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {getAccountTypeLabel(a.type, locale)} ·{" "}
                      {formatOwnerName(store, a.ownerId, locale)}
                    </small>
                  </span>
                </span>
                <span className="account-capabilities">
                  <span className="mini-tag">
                    {a.assetEnabled
                      ? t.accounts.capabilityAsset
                      : t.accounts.capabilityLedgerOnly}
                  </span>
                  {a.expenseEnabled && (
                    <span className="mini-tag">{t.accounts.capabilityExpense}</span>
                  )}
                  {a.archived && <span className="mini-tag">{t.common.archived}</span>}
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
          {!store.accounts.length && (
            <Empty
              title={t.accounts.emptyAccountsTitle}
              text={t.accounts.emptyAccountsText}
            />
          )}
        </section>
        <section className="panel history-panel">
          <PanelTitle
            title={t.accounts.sourcesPanelTitle}
            subtitle={t.accounts.sourcesPanelSubtitle}
            right={
              <span className="section-count">
                {t.accounts.sourceCount(sources.length)}
              </span>
            }
          />
          <ul className="income-sources">
            {sources.map((l) => (
              <li key={l.id}>
                <Icon name="down" size={18} />
                <strong>{l.name}</strong>
                <span className="owner-tag">
                  {formatOwnerName(store, l.ownerId, locale)}
                </span>
                {l.archived && <span className="mini-tag">{t.common.archived}</span>}
              </li>
            ))}
          </ul>
          {!sources.length && (
            <Empty
              title={t.accounts.emptySourcesTitle}
              text={t.accounts.emptySourcesText}
            />
          )}
        </section>
      </div>
    </div>
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
  const { t } = usePreferences();
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
          aria-label={t.common.close}
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
  const { locale, t } = usePreferences();
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
      setError(message(e, locale));
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
        {t.modals.name}
        <input
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={income ? t.modals.incomePlaceholder : t.modals.accountPlaceholder}
        />
      </label>
      <label>
        {t.modals.owner}
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">{t.common.shared}</option>
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
            {t.modals.type}
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
              {accountTypes.map((accountType) => (
                <option key={accountType} value={accountType}>
                  {getAccountTypeLabel(accountType, locale)}
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
            {t.modals.useForAsset}
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={expense}
              onChange={(e) => setExpense(e.target.checked)}
            />
            {t.modals.useForExpense}
          </label>
          {account && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              {t.modals.archiveAccount}
            </label>
          )}
        </>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy && <span className="button-spinner" aria-hidden="true" />}
        {busy ? t.common.saving : t.common.save}
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
  const { locale, t } = usePreferences();
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
      setError(message(e, locale));
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
          {t.modals.valuationDate}
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
          {t.modals.datePrecision}
          <select
            value={precision}
            onChange={(e) => {
              setPrecision(e.target.value === "MONTH" ? "MONTH" : "DAY");
              setValues({});
              setNotes({});
            }}
          >
            <option value="DAY">{t.modals.exactDate}</option>
            <option value="MONTH">{t.modals.monthOnly}</option>
          </select>
        </label>
      </div>
      <p className="muted">{t.modals.balanceHint}</p>
      <div className="balance-fields">
        {accounts.map((a) => (
          <div key={a.id}>
            <label>
              {a.name}
              <small>
                {formatOwnerName(store, a.ownerId, locale)} ·{" "}
                {previous.find((b) => b.accountId === a.id)
                  ? t.modals.latestBalance(
                      money(previous.find((b) => b.accountId === a.id)!.amountMinor),
                    )
                  : t.common.notRecordedYet}
              </small>
              <input
                aria-label={t.modals.balanceAria(a.name)}
                inputMode="decimal"
                placeholder={t.modals.balancePlaceholder}
                value={values[a.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
              />
            </label>
            <input
              aria-label={t.modals.balanceNoteAria(a.name)}
              maxLength={500}
              placeholder={t.modals.balanceNotePlaceholder}
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes((v) => ({ ...v, [a.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <button className="primary-button" disabled={busy || !accounts.length}>
        {busy && <span className="button-spinner" aria-hidden="true" />}
        {busy ? t.common.saving : t.modals.saveValuations}
      </button>
    </form>
  );
}
