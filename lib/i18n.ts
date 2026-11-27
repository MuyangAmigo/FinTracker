import type { Account, Store } from "../shared/finance";

export type Locale = "zh-CN" | "en";
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const LOCALE_STORAGE_KEY = "fintracker-locale";
export const THEME_STORAGE_KEY = "fintracker-theme";

export const preferencesInitScript = `(()=>{try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(l==="en"||l==="zh-CN"){document.documentElement.lang=l;}}catch{}})();`;

export function parseLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "zh-CN";
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "dark") return value;
  return "system";
}

export function getDocumentLocale(): Locale {
  if (typeof document !== "undefined" && document.documentElement.lang === "en") {
    return "en";
  }
  return "zh-CN";
}

const accountTypeLabels: Record<Locale, Record<Account["type"], string>> = {
  "zh-CN": {
    BANK: "银行余额",
    WALLET: "电子钱包",
    DEPOSIT: "存款",
    INVESTMENT: "投资",
    INSURANCE: "保险",
    PROPERTY: "房产",
    VEHICLE: "车辆",
    CREDIT_CARD: "信用卡",
    SHARED_POT: "公用小荷包",
    OTHER: "其他",
  },
  en: {
    BANK: "Bank",
    WALLET: "Wallet",
    DEPOSIT: "Deposit",
    INVESTMENT: "Investment",
    INSURANCE: "Insurance",
    PROPERTY: "Property",
    VEHICLE: "Vehicle",
    CREDIT_CARD: "Credit Card",
    SHARED_POT: "Shared Pot",
    OTHER: "Other",
  },
};

export function getAccountTypeLabel(type: Account["type"], locale: Locale): string {
  return accountTypeLabels[locale][type];
}

const enMonthShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMonthShort(monthIndex: number, locale: Locale): string {
  return locale === "en" ? enMonthShort[monthIndex] : `${monthIndex + 1}月`;
}

export function formatOwnerName(store: Store, id: string | null, locale: Locale): string {
  return (
    store.people.find((person) => person.id === id)?.name ??
    (locale === "en" ? "Shared" : "共同")
  );
}

const validationMessageMap: Record<string, string> = {
  日期无效: "Invalid date",
  金额最多两位小数: "Amount can have at most two decimal places",
  信用卡支出不属于资产余额: "Credit card spending is not an asset balance",
  不能重复记录同一行: "Duplicate line entries are not allowed",
  资产金额不能为负: "Asset balance cannot be negative",
  不能重复记录同一账户: "Duplicate account entries are not allowed",
};

export function translateValidationMessage(text: string, locale: Locale): string {
  if (locale !== "en") return text;
  let translated = text;
  for (const [zh, en] of Object.entries(validationMessageMap)) {
    translated = translated.replaceAll(zh, en);
  }
  return translated;
}

export interface Copy {
  documentTitle: string;
  brand: {
    homeAriaLabel: string;
    tagline: string;
  };
  boot: {
    opening: string;
  };
  controls: {
    groupLabel: string;
    switchToEnglish: string;
    switchToChinese: string;
    switchToDark: string;
    switchToLight: string;
    darkLabel: string;
    lightLabel: string;
  };
  pages: {
    dashboard: [string, string];
    ledger: [string, string];
    assets: [string, string];
    accounts: [string, string];
  };
  nav: {
    ariaLabel: string;
    spaceLabel: string;
    dashboard: string;
    ledger: string;
    assets: string;
    accounts: string;
    signOut: string;
    collapse: string;
    expand: string;
    expandShort: string;
  };
  auth: {
    signIn: string;
    redirecting: string;
    notReady: string;
    notReadyRetry: string;
    signInFirst: string;
    signInRequired: string;
    completeAuth: string;
    requestFailed: (status: number) => string;
    genericError: string;
    reload: string;
    retrySignIn: string;
  };
  loading: {
    loadingRecords: string;
    loadingDetail: string;
    syncingRecords: string;
  };
  landing: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    descriptionLines: readonly [string, string, string];
    notebookHeading: string;
    notebookTitleLine1: string;
    notebookTitleLine2: string;
    notebookChartCaption: string;
    notebookBottom: string;
    labelIncome: string;
    labelHome: string;
    featuresAriaLabel: string;
    features: readonly {
      icon: "book" | "wallet" | "lock";
      number: string;
      title: string;
      text: string;
    }[];
    setupNotice: string;
    setupGuide: string;
  };
  year: {
    previous: string;
    next: string;
    label: string;
    option: (year: string) => string;
  };
  common: {
    saved: string;
    savedReloadError: (detail: string) => string;
    unsavedConfirm: string;
    close: string;
    saving: string;
    save: string;
    archivedSuffix: string;
    archived: string;
    unrecorded: string;
    complete: string;
    incomplete: string;
    shared: string;
    unknown: string;
    notRecordedYet: string;
    optional: string;
  };
  empty: {
    dashboardTitle: string;
    dashboardText: string;
    ledgerTitle: string;
    ledgerText: string;
    assetsTitle: string;
    assetsText: string;
    accountsTitle: string;
    accountsText: string;
  };
  exportBar: {
    caption: string;
    monthly: string;
    assets: string;
    backup: string;
  };
  metrics: {
    totalIncome: string;
    totalIncomeNote: string;
    totalExpense: string;
    totalExpenseNote: string;
    totalSavings: string;
    totalSavingsPartialNote: string;
    totalSavingsCompleteNote: string;
    savingsRate: string;
    savingsRateNa: string;
    savingsRateNote: string;
  };
  dashboard: {
    cashFlowHeading: string;
    trendTitle: string;
    trendSubtitle: string;
    legendIncome: string;
    legendExpense: string;
    annualAriaLabel: (year: string) => string;
    annualHeading: string;
    annualContext: (recorded: number, complete: number) => string;
    assetsHeading: string;
    assetsAsOf: (asOf: string) => string;
    totalAssets: string;
    totalAssetsNote: (count: number) => string;
    distributionTitle: string;
    distributionSubtitle: string;
    noAssetsTitle: string;
    noAssetsText: string;
    donutAriaLabel: string;
    donutSmall: string;
    donutUnit: (count: number) => string;
  };
  trend: {
    scrollAriaLabel: string;
    chartAriaLabel: (year: string) => string;
    columnTitle: (
      month: string,
      income: string,
      expense: string,
      incomplete: boolean,
    ) => string;
    scrollHint: string;
    exactSummary: string;
    exactTableAriaLabel: (year: string) => string;
    colMonth: string;
    colIncome: string;
    colExpense: string;
    colStatus: string;
  };
  ledger: {
    summaryAriaLabel: (year: string) => string;
    summaryHeading: string;
    summarySubtitle: string;
    monthlyHeading: string;
    monthlySubtitle: string;
    viewSwitchAriaLabel: string;
    boardView: string;
    tableView: string;
    view: string;
    edit: string;
    viewMonthAria: (month: string) => string;
    editMonthAria: (month: string) => string;
    boardRegionAria: (year: string) => string;
    colMissing: string;
    colPartial: string;
    colComplete: string;
    monthsCountAria: (count: number) => string;
    monthCardAria: (month: string) => string;
    income: string;
    expense: string;
    savings: string;
    savingsRate: string;
    partialSavingsNote: string;
    emptyColumn: string;
    boardScrollHint: string;
    tableTitle: (year: string) => string;
    tableSubtitle: string;
    tableRegionAria: string;
    colMonth: string;
    colIncomeStatus: string;
    colExpenseStatus: string;
    colActions: string;
    tableFooter: string;
    modalViewTitle: (month: string) => string;
    modalEditTitle: (month: string) => string;
    clearConfirm: string;
    incomePanelTitle: string;
    incomePanelSubtitle: string;
    expensePanelTitle: string;
    expensePanelSubtitle: string;
    addSource: string;
    addAccount: string;
    colIncomeSource: string;
    colAccount: string;
    colOwner: string;
    colAmount: string;
    colNote: string;
    amountAria: (name: string) => string;
    amountPlaceholder: string;
    noteAria: (name: string) => string;
    emptyRowTitle: string;
    emptyRowText: string;
    incomeCompleteLabel: string;
    expenseCompleteLabel: string;
    blankNotZero: string;
    saveBarNote: string;
    saveMonthButton: string;
  };
  assets: {
    summaryAriaLabel: string;
    latestKnownAsOf: (month: string) => string;
    summaryNote: string;
    valuationMonth: string;
    recordMonthAria: string;
    recordNewBalances: string;
    accountsPanelTitle: string;
    accountsPanelSubtitle: string;
    tableScrollHint: string;
    balancesRegionAria: string;
    balancesTableAria: string;
    colAssetAccount: string;
    colType: string;
    colOwner: string;
    colLatestBalance: string;
    colValuationDate: string;
    priorValuation: string;
    noAccountsTitle: string;
    noAccountsText: string;
    historyBandAria: string;
    historyTitle: string;
    historySubtitle: string;
    historyRegionAria: string;
    historyTableAria: string;
    colDate: string;
    colAccount: string;
    colBalance: string;
    colNote: string;
    referencesSummary: string;
    colPeriod: string;
    colRefKind: string;
    colSourceValue: string;
    colSourceNote: string;
  };
  accounts: {
    actionsAriaLabel: string;
    manageHeading: string;
    manageDescription: string;
    addAccount: string;
    addIncomeSource: string;
    guidanceHeading: string;
    guidanceText: string;
    accountsPanelTitle: string;
    accountsPanelSubtitle: string;
    accountCount: (count: number) => string;
    editAccountAria: (name: string) => string;
    capabilityAsset: string;
    capabilityLedgerOnly: string;
    capabilityExpense: string;
    emptyAccountsTitle: string;
    emptyAccountsText: string;
    sourcesPanelTitle: string;
    sourcesPanelSubtitle: string;
    sourceCount: (count: number) => string;
    emptySourcesTitle: string;
    emptySourcesText: string;
  };
  modals: {
    recordBalance: string;
    addIncome: string;
    editAccount: string;
    addAccount: string;
    name: string;
    incomePlaceholder: string;
    accountPlaceholder: string;
    owner: string;
    type: string;
    useForAsset: string;
    useForExpense: string;
    archiveAccount: string;
    valuationDate: string;
    datePrecision: string;
    exactDate: string;
    monthOnly: string;
    balanceHint: string;
    latestBalance: (formatted: string) => string;
    balanceAria: (name: string) => string;
    balancePlaceholder: string;
    balanceNoteAria: (name: string) => string;
    balanceNotePlaceholder: string;
    saveValuations: string;
  };
}

export const copy: Record<Locale, Copy> = {
  "zh-CN": {
    documentTitle: "FinTracker · 家庭财务",
    brand: {
      homeAriaLabel: "FinTracker 首页",
      tagline: "一起，积累好生活",
    },
    boot: {
      opening: "正在打开私人财务空间…",
    },
    controls: {
      groupLabel: "显示与语言设置",
      switchToEnglish: "切换为英文 (Switch to English)",
      switchToChinese: "切换为中文 (Switch to Chinese)",
      switchToDark: "切换到深色模式",
      switchToLight: "切换到浅色模式",
      darkLabel: "深色模式",
      lightLabel: "浅色模式",
    },
    pages: {
      dashboard: ["财务总览", "按年查看家庭收支与资产估值"],
      ledger: ["月度记账", "按记录状态整理每个月，收入与支出的完整性分别保留。"],
      assets: ["资产管理", "按实际余额登记资产。历史估值会保留，收支不会自动改变余额。"],
      accounts: ["账户设置", "管理个人与共同账户，以及月度收入来源。"],
    },
    nav: {
      ariaLabel: "主导航",
      spaceLabel: "家庭财务空间",
      dashboard: "财务总览",
      ledger: "月度记账",
      assets: "资产管理",
      accounts: "账户设置",
      signOut: "退出登录",
      collapse: "收起导航栏",
      expand: "展开导航栏",
      expandShort: "展开",
    },
    auth: {
      signIn: "Microsoft 登录",
      redirecting: "正在跳转…",
      notReady: "登录尚未就绪",
      notReadyRetry: "登录尚未就绪，请稍后重试",
      signInFirst: "请先登录",
      signInRequired: "请先使用 Microsoft 账户登录",
      completeAuth: "请完成登录授权",
      requestFailed: (status) => `请求失败 (${status})`,
      genericError: "操作失败，请重试",
      reload: "重新加载",
      retrySignIn: "重试登录",
    },
    loading: {
      loadingRecords: "正在安全加载记录…",
      loadingDetail: "正在连接私人服务并同步家庭数据",
      syncingRecords: "正在同步最新记录…",
    },
    landing: {
      kicker: "两个人 · 一个家 · 一本账",
      titleLine1: "把生活过好，",
      titleLine2: "把账记清。",
      descriptionLines: [
        "不必追着每一笔开销跑。",
        "每月一起理清收支，看看积累，",
        "为想要的生活，留一份从容。",
      ],
      notebookHeading: "THE HOME LEDGER",
      notebookTitleLine1: "生活有度，",
      notebookTitleLine2: "积累有迹。",
      notebookChartCaption: "把日子，慢慢过成喜欢的样子",
      notebookBottom: "OUR LIFE, IN BALANCE",
      labelIncome: "收支有数",
      labelHome: "心里有底，生活有光",
      featuresAriaLabel: "账本能帮你做什么",
      features: [
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
      ],
      setupNotice: "登录服务尚未配置，连接 Microsoft 登录和私人 API 后即可使用。",
      setupGuide: "配置说明",
    },
    year: {
      previous: "上一年",
      next: "下一年",
      label: "记录年份",
      option: (year) => `${year} 年`,
    },
    common: {
      saved: "已保存",
      savedReloadError: (detail) => `已保存，但无法重新加载记录：${detail}`,
      unsavedConfirm: "有未保存的修改，确定离开吗？",
      close: "关闭",
      saving: "保存中…",
      save: "保存",
      archivedSuffix: " · 已归档",
      archived: "已归档",
      unrecorded: "未记录",
      complete: "完整",
      incomplete: "未完成",
      shared: "共同",
      unknown: "未知",
      notRecordedYet: "未登记",
      optional: "选填",
    },
    empty: {
      dashboardTitle: "财务总览",
      dashboardText: "正在等待真实家庭记录。",
      ledgerTitle: "月度记账",
      ledgerText: "登录并连接私人 API 后，即可批量录入每个月的收入与账户支出。",
      assetsTitle: "资产管理",
      assetsText: "登记实际资产余额，保留每一次估值的历史。",
      accountsTitle: "你的账户，你来定义",
      accountsText: "信用卡、公用小荷包、存款、投资、房产和车辆，都能在这里管理。",
    },
    exportBar: {
      caption: "你的记录，始终由你掌握。",
      monthly: "导出月度收支",
      assets: "导出资产历史",
      backup: "完整数据备份",
    },
    metrics: {
      totalIncome: "总收入",
      totalIncomeNote: "本年已登记收入",
      totalExpense: "总支出",
      totalExpenseNote: "本年已登记支出",
      totalSavings: "总结余",
      totalSavingsPartialNote: "未完成月份仅计已记录差额",
      totalSavingsCompleteNote: "已登记收入 − 已登记支出",
      savingsRate: "储蓄率",
      savingsRateNa: "暂不适用",
      savingsRateNote: "记录完整且总收入为正时计算",
    },
    dashboard: {
      cashFlowHeading: "收支",
      trendTitle: "每月收支趋势",
      trendSubtitle: "比较每月收支金额；负数及准确金额见下表，未完成月份以 * 标注",
      legendIncome: "收入",
      legendExpense: "支出",
      annualAriaLabel: (year) => `${year} 年收支汇总`,
      annualHeading: "本年汇总",
      annualContext: (recorded, complete) =>
        `${recorded} 个月已登记 · ${complete} 个月完整`,
      assetsHeading: "资产",
      assetsAsOf: (asOf) => `截至 ${asOf} · 独立于月度收支`,
      totalAssets: "总资产",
      totalAssetsNote: (count) =>
        `${count} 个已登记资产；未更新账户沿用历史估值，未知余额不计为零。`,
      distributionTitle: "资产分布",
      distributionSubtitle: "金融资产、房产及车辆",
      noAssetsTitle: "尚未登记资产余额",
      noAssetsText: "登记实际余额后显示资产分布。",
      donutAriaLabel: "资产类型分布",
      donutSmall: "已登记资产",
      donutUnit: () => "个资产",
    },
    trend: {
      scrollAriaLabel: "月度收支图表，可横向滚动",
      chartAriaLabel: (year) => `${year} 年收支趋势`,
      columnTitle: (month, income, expense, incomplete) =>
        `${month} 收入 ${income}，支出 ${expense}${incomplete ? "（未完成）" : ""}`,
      scrollHint: "左右滑动查看全年，或展开下表",
      exactSummary: "查看准确数值",
      exactTableAriaLabel: (year) => `${year} 年收支准确数值`,
      colMonth: "月份",
      colIncome: "收入",
      colExpense: "支出",
      colStatus: "状态",
    },
    ledger: {
      summaryAriaLabel: (year) => `${year} 年收支汇总`,
      summaryHeading: "本年汇总",
      summarySubtitle: "已登记数据，未记录不代表零",
      monthlyHeading: "月度记录",
      monthlySubtitle: "按状态整理，或切换表格逐月比较",
      viewSwitchAriaLabel: "月度记录视图",
      boardView: "状态看板",
      tableView: "对比表格",
      view: "查看",
      edit: "编辑",
      viewMonthAria: (month) => `查看 ${month}`,
      editMonthAria: (month) => `编辑 ${month}`,
      boardRegionAria: (year) => `${year} 年月度状态看板，可横向滚动`,
      colMissing: "未记录",
      colPartial: "待补全",
      colComplete: "已完成",
      monthsCountAria: (count) => `${count} 个月`,
      monthCardAria: (month) => `${month} 月度记录`,
      income: "收入",
      expense: "支出",
      savings: "结余",
      savingsRate: "储蓄率",
      partialSavingsNote: "* 结余仅为已记录差额",
      emptyColumn: "暂无此状态的月份",
      boardScrollHint: "左右滑动查看其他状态，也可切换对比表格。",
      tableTitle: (year) => `${year} 年每月汇总`,
      tableSubtitle: "按月份倒序排列；查看或编辑在弹窗中打开，空白与零分别显示",
      tableRegionAria: "月度汇总表格，可横向滚动",
      colMonth: "月份",
      colIncomeStatus: "收入状态",
      colExpenseStatus: "支出状态",
      colActions: "操作",
      tableFooter: "* 未完成月份的结余为已记录差额，不能代表完整月度结余。",
      modalViewTitle: (month) => `${month} 收支详情`,
      modalEditTitle: (month) => `${month} 编辑月度记录`,
      clearConfirm: "清空金额会删除对应的本月记录。确定保存吗？",
      incomePanelTitle: "月度收入",
      incomePanelSubtitle: "工资、股权、其他收入",
      expensePanelTitle: "账户支出",
      expensePanelSubtitle: "记录消费支出，不重复记录信用卡还款或账户转账",
      addSource: "新增来源",
      addAccount: "新增账户",
      colIncomeSource: "收入来源",
      colAccount: "账户",
      colOwner: "归属",
      colAmount: "金额",
      colNote: "备注",
      amountAria: (name) => `${name} 金额`,
      amountPlaceholder: "尚未记录",
      noteAria: (name) => `${name} 备注`,
      emptyRowTitle: "先添加一行",
      emptyRowText: "新账户或收入来源会自动出现在每个月的记账表中。",
      incomeCompleteLabel: "全家庭本月收入已记录完整",
      expenseCompleteLabel: "全家庭本月支出已记录完整",
      blankNotZero: "空白 ≠ 零",
      saveBarNote: "保存不会修改任何资产余额。",
      saveMonthButton: "保存本月记录",
    },
    assets: {
      summaryAriaLabel: "资产汇总",
      latestKnownAsOf: (month) => `截至 ${month} 的最近已知资产`,
      summaryNote: "未更新的账户沿用旧估值，未知余额不计为零。",
      valuationMonth: "估值月份",
      recordMonthAria: "记录月份",
      recordNewBalances: "登记新的余额",
      accountsPanelTitle: "账户与资产",
      accountsPanelSubtitle: "查看每个余额的实际记录日期",
      tableScrollHint: "左右滑动查看完整账户、余额与估值日期。",
      balancesRegionAria: "资产账户余额，可横向滚动",
      balancesTableAria: "资产账户余额",
      colAssetAccount: "资产账户",
      colType: "类型",
      colOwner: "归属",
      colLatestBalance: "最近余额",
      colValuationDate: "估值日期",
      priorValuation: "历史估值",
      noAccountsTitle: "还没有资产账户",
      noAccountsText: "在账户设置里添加银行、投资、房产或车辆。",
      historyBandAria: "资产历史与参考",
      historyTitle: "估值历史",
      historySubtitle: "每一次记录都保留，不由月度收支推算",
      historyRegionAria: "资产估值历史，可横向滚动",
      historyTableAria: "资产估值历史",
      colDate: "日期",
      colAccount: "账户",
      colBalance: "余额",
      colNote: "备注",
      referencesSummary: "原始表格汇总参考（不重复计入资产）",
      colPeriod: "期间",
      colRefKind: "参考类型",
      colSourceValue: "原始值",
      colSourceNote: "原始说明",
    },
    accounts: {
      actionsAriaLabel: "账户操作",
      manageHeading: "管理账户",
      manageDescription: "添加真实使用的账户与收入来源，每月整理时就能直接填写。",
      addAccount: "新增账户",
      addIncomeSource: "新增收入来源",
      guidanceHeading: "归档，仍保留历史",
      guidanceText: "归档不会清空已有余额。资产处置后，请先登记一次零估值。",
      accountsPanelTitle: "账户与资产项目",
      accountsPanelSubtitle: "归档保留历史，不会自动抹去资产余额",
      accountCount: (count) => `${count} 个账户`,
      editAccountAria: (name) => `编辑账户 ${name}`,
      capabilityAsset: "资产",
      capabilityLedgerOnly: "仅记账",
      capabilityExpense: "月度支出",
      emptyAccountsTitle: "先添加一个账户",
      emptyAccountsText: "账户名称、归属和类型都可以由你定义。",
      sourcesPanelTitle: "收入来源",
      sourcesPanelSubtitle: "新增来源会出现在每个月的收入表里",
      sourceCount: (count) => `${count} 个来源`,
      emptySourcesTitle: "尚未添加收入来源",
      emptySourcesText: "添加工资、股权或其他实际收入来源。",
    },
    modals: {
      recordBalance: "登记资产余额",
      addIncome: "新增收入来源",
      editAccount: "编辑账户",
      addAccount: "新增账户",
      name: "名称",
      incomePlaceholder: "例如：工资",
      accountPlaceholder: "例如：信用卡、公用小荷包",
      owner: "归属",
      type: "类型",
      useForAsset: "用于资产余额",
      useForExpense: "用于月度支出",
      archiveAccount: "归档账户（保留历史和非零资产余额）",
      valuationDate: "估值日期",
      datePrecision: "日期精度",
      exactDate: "确切日期",
      monthOnly: "仅知道月份",
      balanceHint:
        "只保存填写的账户。空白不会将旧余额重置为零。同日期填写会更新该次估值。",
      latestBalance: (formatted) => `最近 ${formatted}`,
      balanceAria: (name) => `${name} 余额`,
      balancePlaceholder: "本次不更新",
      balanceNoteAria: (name) => `${name} 估值备注`,
      balanceNotePlaceholder: "备注（选填）",
      saveValuations: "保存本次估值",
    },
  },
  en: {
    documentTitle: "FinTracker · Household Finance",
    brand: {
      homeAriaLabel: "FinTracker Home",
      tagline: "Building a good life together",
    },
    boot: {
      opening: "Opening your private finance space…",
    },
    controls: {
      groupLabel: "Display and language settings",
      switchToEnglish: "Switch to English",
      switchToChinese: "Switch to Chinese (切换为中文)",
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
      darkLabel: "Dark mode",
      lightLabel: "Light mode",
    },
    pages: {
      dashboard: ["Overview", "Review yearly household cash flow and asset valuations."],
      ledger: [
        "Monthly Ledger",
        "Organize each month by status, keeping income and spending completeness separate.",
      ],
      assets: [
        "Assets",
        "Record actual asset balances. History is preserved and cash flow never alters balances.",
      ],
      accounts: [
        "Accounts",
        "Manage personal and shared accounts along with monthly income sources.",
      ],
    },
    nav: {
      ariaLabel: "Primary navigation",
      spaceLabel: "Household Finance",
      dashboard: "Overview",
      ledger: "Monthly Ledger",
      assets: "Assets",
      accounts: "Accounts",
      signOut: "Sign out",
      collapse: "Collapse sidebar",
      expand: "Expand sidebar",
      expandShort: "Expand",
    },
    auth: {
      signIn: "Sign in with Microsoft",
      redirecting: "Redirecting…",
      notReady: "Sign-in is not ready",
      notReadyRetry: "Sign-in is not ready. Please try again shortly.",
      signInFirst: "Please sign in first",
      signInRequired: "Please sign in with your Microsoft account first",
      completeAuth: "Please complete sign-in authorization",
      requestFailed: (status) => `Request failed (${status})`,
      genericError: "Operation failed. Please try again.",
      reload: "Reload",
      retrySignIn: "Retry sign-in",
    },
    loading: {
      loadingRecords: "Loading records securely…",
      loadingDetail: "Connecting to your private service and syncing household data",
      syncingRecords: "Syncing latest records…",
    },
    landing: {
      kicker: "Two people · One home · One ledger",
      titleLine1: "Live well, ",
      titleLine2: "keep clear records.",
      descriptionLines: [
        "No need to chase every receipt.",
        "Review income and spending together each month,",
        "and build room for the life you want.",
      ],
      notebookHeading: "THE HOME LEDGER",
      notebookTitleLine1: "Measured life, ",
      notebookTitleLine2: "steady growth.",
      notebookChartCaption: "Building the life you love, month by month",
      notebookBottom: "OUR LIFE, IN BALANCE",
      labelIncome: "Clear cash flow",
      labelHome: "Peace of mind at home",
      featuresAriaLabel: "What this ledger helps you do",
      features: [
        {
          icon: "book",
          number: "01",
          title: "Monthly totals, clearly tracked",
          text: "Organize monthly income and account spending without logging every single purchase.",
        },
        {
          icon: "wallet",
          number: "02",
          title: "Every asset in plain view",
          text: "Record actual balances for deposits, investments, property, and vehicles independently.",
        },
        {
          icon: "lock",
          number: "03",
          title: "A private space for two",
          text: "Personal and shared accounts stay distinct, open only to approved household members.",
        },
      ],
      setupNotice:
        "Sign-in is not configured yet. Connect Microsoft sign-in and your private API to get started.",
      setupGuide: "Setup guide",
    },
    year: {
      previous: "Previous year",
      next: "Next year",
      label: "Record year",
      option: (year) => year,
    },
    common: {
      saved: "Saved",
      savedReloadError: (detail) => `Saved, but failed to reload records: ${detail}`,
      unsavedConfirm: "You have unsaved changes. Leave anyway?",
      close: "Close",
      saving: "Saving…",
      save: "Save",
      archivedSuffix: " · Archived",
      archived: "Archived",
      unrecorded: "Unrecorded",
      complete: "Complete",
      incomplete: "Incomplete",
      shared: "Shared",
      unknown: "Unknown",
      notRecordedYet: "Unrecorded",
      optional: "Optional",
    },
    empty: {
      dashboardTitle: "Overview",
      dashboardText: "Waiting for household records.",
      ledgerTitle: "Monthly Ledger",
      ledgerText:
        "Sign in and connect your private API to record monthly income and account spending.",
      assetsTitle: "Assets",
      assetsText: "Record actual asset balances and preserve each valuation in history.",
      accountsTitle: "Your accounts, your structure",
      accountsText:
        "Manage credit cards, shared pots, deposits, investments, property, and vehicles here.",
    },
    exportBar: {
      caption: "Your records stay under your control.",
      monthly: "Export monthly CSV",
      assets: "Export assets CSV",
      backup: "Full JSON backup",
    },
    metrics: {
      totalIncome: "Total Income",
      totalIncomeNote: "Recorded income this year",
      totalExpense: "Total Spending",
      totalExpenseNote: "Recorded spending this year",
      totalSavings: "Net Savings",
      totalSavingsPartialNote: "Incomplete months reflect recorded amounts only",
      totalSavingsCompleteNote: "Recorded income − recorded spending",
      savingsRate: "Savings Rate",
      savingsRateNa: "N/A",
      savingsRateNote: "Requires complete records and positive income",
    },
    dashboard: {
      cashFlowHeading: "Cash Flow",
      trendTitle: "Monthly Cash Flow Trend",
      trendSubtitle:
        "Compare monthly totals; see table below for signed exact figures. Incomplete months are marked with *.",
      legendIncome: "Income",
      legendExpense: "Spending",
      annualAriaLabel: (year) => `${year} cash flow summary`,
      annualHeading: "Annual Summary",
      annualContext: (recorded, complete) =>
        `${recorded} mo recorded · ${complete} mo complete`,
      assetsHeading: "Assets",
      assetsAsOf: (asOf) => `As of ${asOf} · Independent from cash flow`,
      totalAssets: "Total Assets",
      totalAssetsNote: (count) =>
        `${count} recorded ${count === 1 ? "asset" : "assets"}; unchanged accounts keep prior valuations, and unknown balances are not zero.`,
      distributionTitle: "Asset Allocation",
      distributionSubtitle: "Financial assets, property, and vehicles",
      noAssetsTitle: "No asset balances yet",
      noAssetsText: "Record actual balances to view asset allocation.",
      donutAriaLabel: "Asset allocation by type",
      donutSmall: "Recorded",
      donutUnit: (count) => (count === 1 ? "asset" : "assets"),
    },
    trend: {
      scrollAriaLabel: "Monthly cash flow chart, scrollable horizontally",
      chartAriaLabel: (year) => `${year} cash flow trend`,
      columnTitle: (month, income, expense, incomplete) =>
        `${month} Income ${income}, Spending ${expense}${incomplete ? " (Incomplete)" : ""}`,
      scrollHint: "Scroll horizontally to view the full year, or expand the table below",
      exactSummary: "View exact figures",
      exactTableAriaLabel: (year) => `${year} exact cash flow figures`,
      colMonth: "Month",
      colIncome: "Income",
      colExpense: "Spending",
      colStatus: "Status",
    },
    ledger: {
      summaryAriaLabel: (year) => `${year} cash flow summary`,
      summaryHeading: "Annual Summary",
      summarySubtitle: "Recorded data only; blank does not mean zero",
      monthlyHeading: "Monthly Records",
      monthlySubtitle: "Organize by status or switch to a comparison table",
      viewSwitchAriaLabel: "Monthly records view",
      boardView: "Status Board",
      tableView: "Comparison Table",
      view: "View",
      edit: "Edit",
      viewMonthAria: (month) => `View ${month}`,
      editMonthAria: (month) => `Edit ${month}`,
      boardRegionAria: (year) => `${year} monthly status board, scrollable horizontally`,
      colMissing: "Unrecorded",
      colPartial: "Incomplete",
      colComplete: "Complete",
      monthsCountAria: (count) => `${count} ${count === 1 ? "month" : "months"}`,
      monthCardAria: (month) => `${month} monthly record`,
      income: "Income",
      expense: "Spending",
      savings: "Savings",
      savingsRate: "Savings Rate",
      partialSavingsNote: "* Savings reflects recorded amounts only",
      emptyColumn: "No months in this status",
      boardScrollHint:
        "Scroll horizontally to view other statuses, or switch to the comparison table.",
      tableTitle: (year) => `${year} Monthly Summary`,
      tableSubtitle:
        "Newest first; view or edit in a dialog. Blank and zero are shown separately.",
      tableRegionAria: "Monthly summary table, scrollable horizontally",
      colMonth: "Month",
      colIncomeStatus: "Income Status",
      colExpenseStatus: "Spending Status",
      colActions: "Actions",
      tableFooter:
        "* Savings for incomplete months reflects recorded amounts only, not full monthly net savings.",
      modalViewTitle: (month) => `${month} Details`,
      modalEditTitle: (month) => `Edit ${month}`,
      clearConfirm: "Clearing an amount deletes that entry for this month. Save anyway?",
      incomePanelTitle: "Monthly Income",
      incomePanelSubtitle: "Salary, equity, and other income",
      expensePanelTitle: "Account Spending",
      expensePanelSubtitle:
        "Record spending only; do not duplicate credit card repayments or transfers",
      addSource: "Add source",
      addAccount: "Add account",
      colIncomeSource: "Income Source",
      colAccount: "Account",
      colOwner: "Owner",
      colAmount: "Amount",
      colNote: "Note",
      amountAria: (name) => `${name} amount`,
      amountPlaceholder: "Unrecorded",
      noteAria: (name) => `${name} note`,
      emptyRowTitle: "Add a row first",
      emptyRowText:
        "New accounts and income sources appear automatically in each monthly form.",
      incomeCompleteLabel: "All household income for this month is complete",
      expenseCompleteLabel: "All household spending for this month is complete",
      blankNotZero: "Blank ≠ Zero",
      saveBarNote: "Saving does not change any asset balances.",
      saveMonthButton: "Save Monthly Record",
    },
    assets: {
      summaryAriaLabel: "Asset summary",
      latestKnownAsOf: (month) => `Latest known assets as of ${month}`,
      summaryNote:
        "Unchanged accounts keep prior valuations; unknown balances are not zero.",
      valuationMonth: "Valuation month",
      recordMonthAria: "Record month",
      recordNewBalances: "Record New Balances",
      accountsPanelTitle: "Accounts & Assets",
      accountsPanelSubtitle: "See the actual valuation date for each balance",
      tableScrollHint:
        "Scroll horizontally to view full account names, balances, and dates.",
      balancesRegionAria: "Asset account balances, scrollable horizontally",
      balancesTableAria: "Asset account balances",
      colAssetAccount: "Asset Account",
      colType: "Type",
      colOwner: "Owner",
      colLatestBalance: "Latest Balance",
      colValuationDate: "Valuation Date",
      priorValuation: "Prior",
      noAccountsTitle: "No asset accounts yet",
      noAccountsText: "Add bank, investment, property, or vehicle accounts in Accounts.",
      historyBandAria: "Asset history and references",
      historyTitle: "Valuation History",
      historySubtitle:
        "Every recorded balance is preserved and never derived from cash flow",
      historyRegionAria: "Asset valuation history, scrollable horizontally",
      historyTableAria: "Asset valuation history",
      colDate: "Date",
      colAccount: "Account",
      colBalance: "Balance",
      colNote: "Note",
      referencesSummary: "Source sheet summary references (not added to assets)",
      colPeriod: "Period",
      colRefKind: "Reference Type",
      colSourceValue: "Source Value",
      colSourceNote: "Source Note",
    },
    accounts: {
      actionsAriaLabel: "Account actions",
      manageHeading: "Manage Accounts",
      manageDescription:
        "Add real accounts and income sources so they are ready for monthly entry.",
      addAccount: "Add Account",
      addIncomeSource: "Add Income Source",
      guidanceHeading: "Archiving keeps history",
      guidanceText:
        "Archiving does not erase balances. Record a zero valuation when disposing of an asset.",
      accountsPanelTitle: "Accounts & Assets",
      accountsPanelSubtitle: "Archiving keeps history without erasing asset balances",
      accountCount: (count) => `${count} ${count === 1 ? "account" : "accounts"}`,
      editAccountAria: (name) => `Edit account ${name}`,
      capabilityAsset: "Asset",
      capabilityLedgerOnly: "Ledger only",
      capabilityExpense: "Monthly spending",
      emptyAccountsTitle: "Add an account first",
      emptyAccountsText: "Define account names, ownership, and types your way.",
      sourcesPanelTitle: "Income Sources",
      sourcesPanelSubtitle: "New sources appear in every monthly income form",
      sourceCount: (count) => `${count} ${count === 1 ? "source" : "sources"}`,
      emptySourcesTitle: "No income sources yet",
      emptySourcesText: "Add salary, equity, or other real income sources.",
    },
    modals: {
      recordBalance: "Record Asset Balances",
      addIncome: "Add Income Source",
      editAccount: "Edit Account",
      addAccount: "Add Account",
      name: "Name",
      incomePlaceholder: "e.g. Salary",
      accountPlaceholder: "e.g. Credit Card, Shared Pot",
      owner: "Owner",
      type: "Type",
      useForAsset: "Track asset balance",
      useForExpense: "Track monthly spending",
      archiveAccount: "Archive account (keeps history and nonzero balances)",
      valuationDate: "Valuation Date",
      datePrecision: "Date Precision",
      exactDate: "Exact date",
      monthOnly: "Month only",
      balanceHint:
        "Only filled accounts are saved. Blank fields never reset balances to zero. Same-date entries update that valuation.",
      latestBalance: (formatted) => `Latest ${formatted}`,
      balanceAria: (name) => `${name} balance`,
      balancePlaceholder: "Leave unchanged",
      balanceNoteAria: (name) => `${name} valuation note`,
      balanceNotePlaceholder: "Note (optional)",
      saveValuations: "Save Valuations",
    },
  },
};
