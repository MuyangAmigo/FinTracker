"use client";

import { usePreferences } from "./preferences";

export type FinancePage = "dashboard" | "ledger" | "assets" | "accounts";

const dashboardBars = [
  [58, 36],
  [64, 42],
  [52, 34],
  [74, 48],
  [66, 38],
  [82, 46],
  [60, 40],
  [70, 44],
  [78, 52],
  [62, 36],
  [68, 42],
  [76, 48],
] as const;

export function BootLoading() {
  const { t } = usePreferences();
  return (
    <main className="boot-loading" role="status" aria-live="polite">
      <div className="boot-loading-card">
        <div className="boot-loading-mark" aria-hidden="true">
          <span className="loading-spinner loading-spinner-lg" />
        </div>
        <div className="boot-loading-brand" aria-hidden="true">
          FinTracker
          <small>{t.brand.tagline}</small>
        </div>
        <p className="boot-loading-text">{t.boot.opening}</p>
        <div className="boot-loading-track" aria-hidden="true">
          <span className="boot-loading-bar" />
        </div>
      </div>
    </main>
  );
}

export function LoadingBanner({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loading-banner${compact ? " is-compact" : ""}`}
    >
      <div className="loading-banner-body">
        <span className="loading-spinner" aria-hidden="true" />
        <div className="loading-banner-copy">
          <span className="loading-banner-title">{title}</span>
          {detail && <span className="loading-banner-detail">{detail}</span>}
        </div>
      </div>
      <div className="loading-banner-track" aria-hidden="true">
        <span className="loading-banner-bar" />
      </div>
    </div>
  );
}

function SkeletonBlock({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <span
      className={`skeleton-block${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

function MetricSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="metrics skeleton-metrics">
      {Array.from({ length: count }, (_, index) => (
        <div className="metric skeleton-metric" key={index}>
          <SkeletonBlock width="42%" height="13px" />
          <SkeletonBlock className="skeleton-metric-value" width="68%" height="28px" />
          <SkeletonBlock width="84%" height="12px" />
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="annual-dashboard">
      <div className="annual-section">
        <div className="section-heading">
          <SkeletonBlock width="64px" height="22px" />
          <div className="skeleton-control-group">
            <SkeletonBlock width="56px" height="36px" className="skeleton-pill" />
            <SkeletonBlock width="96px" height="36px" className="skeleton-pill" />
            <SkeletonBlock width="56px" height="36px" className="skeleton-pill" />
          </div>
        </div>
        <div className="overview-hero">
          <div className="panel hero-chart skeleton-panel">
            <div className="panel-title">
              <div className="skeleton-stack">
                <SkeletonBlock width="128px" height="18px" />
                <SkeletonBlock width="240px" height="13px" />
              </div>
              <div className="skeleton-legend">
                <SkeletonBlock width="48px" height="13px" />
                <SkeletonBlock width="48px" height="13px" />
              </div>
            </div>
            <div className="skeleton-chart">
              <div className="skeleton-chart-axis">
                <SkeletonBlock width="52px" height="12px" />
                <SkeletonBlock width="44px" height="12px" />
                <SkeletonBlock width="32px" height="12px" />
              </div>
              <div className="skeleton-chart-plot">
                {dashboardBars.map(([income, expense], index) => (
                  <div className="skeleton-chart-column" key={index}>
                    <div className="skeleton-chart-bars">
                      <span
                        className="skeleton-block skeleton-bar"
                        style={{ height: `${income}%` }}
                      />
                      <span
                        className="skeleton-block skeleton-bar skeleton-bar-secondary"
                        style={{ height: `${expense}%` }}
                      />
                    </div>
                    <SkeletonBlock width="22px" height="11px" />
                  </div>
                ))}
              </div>
            </div>
            <div className="skeleton-disclosure">
              <SkeletonBlock width="96px" height="14px" />
            </div>
          </div>
          <div className="annual-figures skeleton-panel">
            <SkeletonBlock width="76px" height="16px" />
            <SkeletonBlock className="skeleton-gap-sm" width="148px" height="12px" />
            <MetricSkeletonRow count={4} />
          </div>
        </div>
      </div>
      <div className="annual-section">
        <div className="section-heading">
          <SkeletonBlock width="56px" height="22px" />
          <SkeletonBlock width="168px" height="13px" />
        </div>
        <div className="asset-overview">
          <div className="asset-summary">
            <div className="skeleton-stack skeleton-grow">
              <SkeletonBlock width="56px" height="13px" />
              <SkeletonBlock width="184px" height="34px" />
              <SkeletonBlock width="90%" height="12px" />
              <SkeletonBlock width="70%" height="12px" />
            </div>
          </div>
          <div className="panel asset-distribution skeleton-panel">
            <div className="panel-title">
              <div className="skeleton-stack">
                <SkeletonBlock width="84px" height="18px" />
                <SkeletonBlock width="136px" height="13px" />
              </div>
            </div>
            <div className="composition">
              <div className="skeleton-donut">
                <div className="skeleton-donut-hole">
                  <SkeletonBlock width="44px" height="11px" />
                  <SkeletonBlock width="36px" height="24px" />
                </div>
              </div>
              <div className="composition-list skeleton-composition-list">
                {[72, 64, 56, 48].map((width, index) => (
                  <div key={index}>
                    <SkeletonBlock width={`${width}%`} height="14px" />
                    <SkeletonBlock width="78px" height="14px" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <>
      <div className="ledger-summary">
        <div className="section-heading">
          <div className="skeleton-stack">
            <SkeletonBlock width="84px" height="20px" />
            <SkeletonBlock width="168px" height="12px" />
          </div>
          <div className="skeleton-control-group">
            <SkeletonBlock width="56px" height="36px" className="skeleton-pill" />
            <SkeletonBlock width="96px" height="36px" className="skeleton-pill" />
            <SkeletonBlock width="56px" height="36px" className="skeleton-pill" />
          </div>
        </div>
        <MetricSkeletonRow count={4} />
      </div>
      <div className="monthly-workspace">
        <div className="section-heading">
          <div className="skeleton-stack">
            <SkeletonBlock width="84px" height="20px" />
            <SkeletonBlock width="188px" height="12px" />
          </div>
          <SkeletonBlock width="156px" height="44px" className="skeleton-pill" />
        </div>
        <div className="monthly-board skeleton-board">
          {[0, 1, 2].map((column) => (
            <div className="month-column" key={column}>
              <div className="month-column-heading">
                <SkeletonBlock width="64px" height="16px" />
                <SkeletonBlock width="28px" height="24px" className="skeleton-pill" />
              </div>
              <div className="month-column-items">
                {[0, 1].map((card) => (
                  <div className="month-card skeleton-card" key={card}>
                    <SkeletonBlock width="72px" height="16px" />
                    <div className="month-values">
                      {[0, 1, 2, 3].map((field) => (
                        <div className="skeleton-stack-tight" key={field}>
                          <SkeletonBlock width="36px" height="11px" />
                          <SkeletonBlock width="76%" height="16px" />
                        </div>
                      ))}
                    </div>
                    <div className="skeleton-chip-row">
                      <SkeletonBlock
                        width="64px"
                        height="22px"
                        className="skeleton-pill"
                      />
                      <SkeletonBlock
                        width="64px"
                        height="22px"
                        className="skeleton-pill"
                      />
                    </div>
                    <div className="skeleton-card-actions">
                      <SkeletonBlock
                        width="46%"
                        height="32px"
                        className="skeleton-pill"
                      />
                      <SkeletonBlock
                        width="46%"
                        height="32px"
                        className="skeleton-pill"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AssetsSkeleton() {
  return (
    <div className="asset-bands">
      <div className="asset-summary asset-band skeleton-panel">
        <div className="skeleton-stack">
          <SkeletonBlock width="136px" height="13px" />
          <SkeletonBlock width="196px" height="34px" />
          <SkeletonBlock width="260px" height="12px" />
        </div>
        <div className="asset-period-actions">
          <SkeletonBlock width="196px" height="40px" className="skeleton-pill" />
          <SkeletonBlock width="136px" height="44px" className="skeleton-pill" />
        </div>
      </div>
      <div className="panel asset-band skeleton-panel">
        <div className="panel-title">
          <div className="skeleton-stack">
            <SkeletonBlock width="96px" height="18px" />
            <SkeletonBlock width="176px" height="12px" />
          </div>
        </div>
        <div className="skeleton-table">
          <div className="skeleton-table-head">
            <SkeletonBlock width="72px" height="12px" />
            <SkeletonBlock width="44px" height="12px" />
            <SkeletonBlock width="44px" height="12px" />
            <SkeletonBlock width="64px" height="12px" />
            <SkeletonBlock width="64px" height="12px" />
          </div>
          {[76, 62, 84, 68, 74].map((width, index) => (
            <div className="skeleton-table-row" key={index}>
              <SkeletonBlock width={`${width}%`} height="14px" />
              <SkeletonBlock width="52px" height="14px" />
              <SkeletonBlock width="44px" height="22px" className="skeleton-pill" />
              <SkeletonBlock width="84px" height="14px" />
              <SkeletonBlock width="76px" height="14px" />
            </div>
          ))}
        </div>
      </div>
      <div className="panel history-panel skeleton-panel">
        <div className="panel-title">
          <div className="skeleton-stack">
            <SkeletonBlock width="84px" height="18px" />
            <SkeletonBlock width="208px" height="12px" />
          </div>
        </div>
        <div className="skeleton-table">
          {[68, 78, 60, 72].map((width, index) => (
            <div className="skeleton-table-row" key={index}>
              <SkeletonBlock width="76px" height="14px" />
              <SkeletonBlock width={`${width}%`} height="14px" />
              <SkeletonBlock width="44px" height="22px" className="skeleton-pill" />
              <SkeletonBlock width="84px" height="14px" />
              <SkeletonBlock width="92px" height="14px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="account-layout">
      <div className="accounts-main">
        <div className="panel skeleton-panel">
          <div className="panel-title">
            <div className="skeleton-stack">
              <SkeletonBlock width="116px" height="18px" />
              <SkeletonBlock width="196px" height="12px" />
            </div>
            <SkeletonBlock width="60px" height="14px" />
          </div>
          <div className="account-list">
            {[70, 56, 82, 64].map((width, index) => (
              <div className="skeleton-account-row" key={index}>
                <div className="account-identity">
                  <SkeletonBlock width="24px" height="24px" className="skeleton-circle" />
                  <div className="skeleton-stack-tight skeleton-grow">
                    <SkeletonBlock width={`${width}%`} height="15px" />
                    <SkeletonBlock width="108px" height="12px" />
                  </div>
                </div>
                <div className="skeleton-chip-row">
                  <SkeletonBlock width="48px" height="22px" className="skeleton-pill" />
                  <SkeletonBlock width="60px" height="22px" className="skeleton-pill" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel history-panel skeleton-panel">
          <div className="panel-title">
            <div className="skeleton-stack">
              <SkeletonBlock width="84px" height="18px" />
              <SkeletonBlock width="184px" height="12px" />
            </div>
            <SkeletonBlock width="56px" height="14px" />
          </div>
          <div className="skeleton-sources">
            {[58, 44, 66].map((width, index) => (
              <div className="skeleton-source-row" key={index}>
                <SkeletonBlock width="18px" height="18px" className="skeleton-circle" />
                <SkeletonBlock width={`${width}%`} height="15px" />
                <SkeletonBlock width="46px" height="22px" className="skeleton-pill" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="account-actions skeleton-panel">
        <div className="skeleton-actions-copy">
          <SkeletonBlock width="76px" height="18px" />
          <SkeletonBlock className="skeleton-gap-sm" width="94%" height="13px" />
          <SkeletonBlock className="skeleton-gap-xs" width="76%" height="13px" />
        </div>
        <SkeletonBlock
          className="skeleton-action-button skeleton-pill"
          width="100%"
          height="44px"
        />
        <SkeletonBlock
          className="skeleton-action-button-secondary skeleton-pill"
          width="100%"
          height="44px"
        />
        <div className="account-guidance">
          <SkeletonBlock width="108px" height="14px" />
          <SkeletonBlock className="skeleton-gap-sm" width="96%" height="12px" />
          <SkeletonBlock className="skeleton-gap-xs" width="80%" height="12px" />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton({ page }: { page: FinancePage }) {
  return (
    <div className="workspace-skeleton" aria-hidden="true" data-loading-skeleton={page}>
      {page === "dashboard" && <DashboardSkeleton />}
      {page === "ledger" && <LedgerSkeleton />}
      {page === "assets" && <AssetsSkeleton />}
      {page === "accounts" && <AccountsSkeleton />}
    </div>
  );
}
