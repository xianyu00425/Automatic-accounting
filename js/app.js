﻿// 自动记账 V3 增强版 - JavaScript
// 新增功能：
// 1. 主界面汇总自动更新（当月收入/支出/结余）
// 2. 主界面显示总账户余额
// 3. 账单列表支持账户筛选并显示该账户收支结余

// 数据存储
const Storage = {
    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// 生成唯一 ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化金额
function formatAmount(amount, type) {
    const prefix = type === 'income' ? '+' : '-';
    return `${prefix}￥${parseFloat(amount).toFixed(2)}`;
}

// 获取交易类型显示文本
function getTypeDisplayLabel(type) {
    if (type === 'transfer') return '转账';
    if (type === 'income') return '收入';
    return '支出';
}

// 格式化日期（用于账单列表、待处理等页面显示）
// 统一格式：YYYY/M/D H:mm:ss（与导入文件的支付宝格式一致）
function formatDate(dateStr) {
    if (!dateStr) return '无效日期';
    var s = String(dateStr).trim();
    // 已经是日期字符串（支持 2026-3-30 和 2026/3/30 两种分隔符）
    if (s.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
           d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

// 从 Date 对象格式化显示日期（用于 Excel 导入等 rawValue 不是字符串的场景）
function formatDisplayDate(d) {
    if (!d) return '';
    if (!(d instanceof Date)) {
        d = new Date(d);
    }
    if (isNaN(d.getTime())) return '无效日期';
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
           d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

function rawDateValue(rawValue, fallbackDate) {
    if (rawValue === null || rawValue === undefined) return fallbackDate ? formatDisplayDate(fallbackDate) : '';
    var s = String(rawValue).trim();
    if (s.match(/^\d{4}[-\/]/)) return s;
    if (!isNaN(Number(s)) && Number(s) > 10000) return fallbackDate ? formatDisplayDate(fallbackDate) : s;
    return s;
}

function migrateOldData() {
    var transactions = AppState.getTransactions();
    var needMigrate = false;
    for (var i = 0; i < transactions.length; i++) {
        var dr = transactions[i].dateRaw || '';
        if (!dr || dr.match(/^\d{10,}/) || !transactions[i].rawData) {
            needMigrate = true;
            break;
        }
    }
    if (!needMigrate) return false;
    
    console.log('[数据迁移] 检测到旧格式数据，开始迁移...');
    for (var j = 0; j < transactions.length; j++) {
        var t = transactions[j];
        t.dateRaw = rawDateValue(t.dateRaw, t.date);
        if (!t.rawData) {
            t.rawData = {
                fileType: t.accountId === 'wechat' ? 'wechat' : (t.accountId === 'alipay' ? 'alipay' : ''),
                tradeTime: t.dateRaw,
                tradeType: t.categoryRaw || '',
                counterpartyRaw: t.counterparty || '',
                product: t.categoryRaw || '',
                incomeExpense: t.type === 'income' ? '收入' : t.type === 'transfer' ? '转账' : '支出',
                amountRaw: String(t.amount),
                payMethod: ''
            };
        } else {
            t.rawData.tradeTime = rawDateValue(t.rawData.tradeTime);
        }
    }
    AppState.saveTransactions(transactions);
    console.log('[数据迁移] 已迁移', transactions.length, '条记录');
    return true;
}

// 应用状态管理
const AppState = {
    currentMonth: new Date(2026, 2, 1), // 初始化为2026年3月
    selectedTransaction: null,
    selectedCategory: null,
    editingAccount: null,
    batchMode: false,
    selectedTransactions: new Set(),
    currentCategoryTab: 'expense',
    selectedColor: '#2196F3',
    selectedIcon: 'fa-utensils',
    
    // 获取数据
    getTransactions() {
        return Storage.get('transactions') || [];
    },
    
    getCategories() {
        const defaultCategories = [
            // 支出分类
            { id: '1', name: '餐饮', type: 'expense', icon: 'fa-utensils', color: '#FF9800' },
            { id: '2', name: '交通', type: 'expense', icon: 'fa-car', color: '#2196F3' },
            { id: '3', name: '购物', type: 'expense', icon: 'fa-shopping-bag', color: '#E91E63' },
            { id: '4', name: '娱乐', type: 'expense', icon: 'fa-gamepad', color: '#9C27B0' },
            { id: '5', name: '居住', type: 'expense', icon: 'fa-home', color: '#795548' },
            { id: '6', name: '医疗', type: 'expense', icon: 'fa-hospital', color: '#F44336' },
            { id: '7', name: '教育', type: 'expense', icon: 'fa-graduation-cap', color: '#4CAF50' },
            // 收入分类
            { id: '8', name: '工资', type: 'income', icon: 'fa-money-bill-wave', color: '#4CAF50' },
            { id: '9', name: '奖金', type: 'income', icon: 'fa-gift', color: '#F44336' },
            { id: '10', name: '投资', type: 'income', icon: 'fa-chart-line', color: '#2196F3' },
            // 转账分类
            { id: '11', name: '账户互转', type: 'transfer', icon: 'fa-exchange-alt', color: '#9C27B0' },
            // 默认分类（用于待处理账单快速归类）
            { id: 'default', name: '默认分类', type: 'default', icon: 'fa-folder', color: '#607D8B' }
        ];
        const stored = Storage.get('categories');
        // 如果存储的是空数组或无效数据，返回默认分类
        if (!stored || !Array.isArray(stored) || stored.length === 0) {
            return defaultCategories;
        }
        return stored;
    },
    
    getRules() {
        return Storage.get('rules') || [];
    },
    
    getBudgets() {
        return Storage.get('budgets') || [];
    },
    
    getAccounts() {
        const defaultAccounts = [
            { id: 'alipay', name: '支付宝', type: 'alipay', balance: 0, color: '#1677FF', icon: 'fa-alipay' },
            { id: 'wechat', name: '微信支付', type: 'wechat', balance: 0, color: '#07C160', icon: 'fa-weixin' },
            { id: 'bank', name: '银行卡', type: 'bank', balance: 0, color: '#FF6B00', icon: 'fa-credit-card' },
        ];
        return Storage.get('accounts') || defaultAccounts;
    },
    
    // 保存数据
    saveTransactions(transactions) {
        Storage.set('transactions', transactions);
    },
    
    saveCategories(categories) {
        Storage.set('categories', categories);
    },
    
    saveRules(rules) {
        Storage.set('rules', rules);
    },
    
    saveBudgets(budgets) {
        Storage.set('budgets', budgets);
    },
    
    saveAccounts(accounts) {
        Storage.set('accounts', accounts);
    },
    
    // 【新增功能 1】获取本月统计（自动更新）- V9支持转账
    getMonthlyStats() {
        const transactions = this.getTransactions();
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        const monthTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            return date.getFullYear() === year && date.getMonth() === month;
        });
        
        const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const expense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // 转账不计入收支统计
        return { 
            income, 
            expense, 
            balance: income - expense  // 自动计算结余
        };
    },
    
    // 【新增功能 2】计算总账户余额
    getTotalBalance() {
        const accounts = this.getAccounts();
        return accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
    },
    
    // 【新增功能 3】获取指定账户的交易统计 - V9支持转账
    getAccountStats(accountId) {
        const transactions = this.getTransactions();
        
        // 包括普通交易和转账交易（转出或转入）
        const accountTransactions = transactions.filter(function(t) { 
            return t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId; 
        });
        
        const income = accountTransactions
            .filter(function(t) { return t.type === 'income'; })
            .reduce(function(sum, t) { return sum + Math.abs(t.amount); }, 0);
        
        const expense = accountTransactions
            .filter(function(t) { return t.type === 'expense'; })
            .reduce(function(sum, t) { return sum + Math.abs(t.amount); }, 0);
        
        return {
            income,
            expense,
            balance: income - expense,
            count: accountTransactions.length
        };
    },
    
    // 获取待处理交易
    getPendingTransactions() {
        return this.getTransactions().filter(t => !t.categoryId);
    },
    
    // 添加交易
    addTransaction(transaction) {
        const transactions = this.getTransactions();
        transactions.unshift(transaction);
        this.saveTransactions(transactions);
    },
    
    // 更新交易
    updateTransaction(updated) {
        const transactions = this.getTransactions();
        const index = transactions.findIndex(t => t.id === updated.id);
        if (index !== -1) {
            transactions[index] = updated;
            this.saveTransactions(transactions);
        }
    },
    
    // 删除交易
    deleteTransaction(id) {
        const transactions = this.getTransactions().filter(t => t.id !== id);
        this.saveTransactions(transactions);
    },
    
    // 获取分类名称
    getCategoryName(categoryId) {
        const category = this.getCategories().find(c => c.id === categoryId);
        return category ? category.name : '未分类';
    },
    
    // 获取分类
    getCategory(categoryId) {
        return this.getCategories().find(c => c.id === categoryId);
    },
    
    // 获取账户
    getAccount(accountId) {
        return this.getAccounts().find(a => a.id === accountId);
    },
    
    // 获取账户名称
    getAccountName(accountId) {
        const account = this.getAccount(accountId);
        return account ? account.name : '未指定';
    }
};

// 页面切换
function switchTab(tab) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(`page-${tab}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === tab) {
            item.classList.add('active');
        }
    });
    
    if (tab === 'home') {
        renderHome();
    } else if (tab === 'transactions') {
        renderTransactions();
    } else if (tab === 'pending') {
        renderPending();
    }
}

// 【新增功能 1&2】渲染首页（包含总账户余额）
function renderHome() {
    var stats = AppState.getMonthlyStats();
    console.log('[主页渲染] 当月统计:', JSON.stringify(stats));

    var el = document.getElementById('month-income'); if (el) el.textContent = formatAmount(stats.income, 'income');
    el = document.getElementById('month-expense'); if (el) el.textContent = formatAmount(stats.expense, 'expense');
    el = document.getElementById('month-balance'); if (el) el.textContent = `￥${stats.balance.toFixed(2)}`;

    var totalBalance = AppState.getTotalBalance();
    console.log('[主页渲染] 总余额:', totalBalance);
    el = document.getElementById('total-balance'); if (el) el.textContent = `￥${totalBalance.toFixed(2)}`;

    const accounts = AppState.getAccounts();
    el = document.getElementById('account-count'); if (el) el.textContent = `${accounts.length}个账户`;

    const pending = AppState.getPendingTransactions();
    const pendingAlert = document.getElementById('pending-alert');
    if (pendingAlert) {
        if (pending.length > 0) {
            pendingAlert.style.display = 'flex';
            var pc = document.getElementById('pending-count'); if (pc) pc.textContent = pending.length;
        } else {
            pendingAlert.style.display = 'none';
        }
    }

    renderBudgets();
    renderRecentTransactions();

    // 更新费用分析图表
    if (typeof window.renderExpenseAnalysis === 'function') {
        setTimeout(function() {
            window.renderExpenseAnalysis();
        }, 300);
    }
}

// 渲染预算
function renderBudgets() {
    const budgets = AppState.getBudgets();
    const transactions = AppState.getTransactions();
    const container = document.getElementById('budget-list');
    if (!container) return;
    
    if (budgets.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无预算设置</div>';
        return;
    }
    
    container.innerHTML = budgets.map(budget => {
        const category = AppState.getCategory(budget.categoryId);
        const spend = calculateBudgetSpend(budget, transactions);
        const progress = budget.amount > 0 ? (spend / budget.amount) : 0;
        const progressClass = progress > 0.9 ? 'high' : progress > 0.7 ? 'medium' : 'low';
        
        return `
            <div class="budget-item">
                <div class="budget-header">
                    <span class="budget-name">${category ? category.name : '总预算'}</span>
                    <span class="budget-amount">￥${spend.toFixed(0)} / ￥${budget.amount.toFixed(0)}</span>
                </div>
                <div class="budget-progress">
                    <div class="budget-bar ${progressClass}" style="width: ${Math.min(progress * 100, 100)}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// 计算预算花费
function calculateBudgetSpend(budget, transactions) {
    const now = new Date();
    return transactions
        .filter(t => {
            if (t.type !== 'expense') return false;
            if (budget.categoryId && t.categoryId !== budget.categoryId) return false;
            const date = new Date(t.date);
            if (budget.period === 'month') {
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }
            return date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

// 渲染最近交易
function renderRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    const transactions = AppState.getTransactions().slice(0, 5);
    
    if (transactions.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无交易记录</div>';
        return;
    }
    
    container.innerHTML = transactions.map(t => renderTransactionItem(t)).join('');
}

// 渲染交易项
function renderTransactionItem(t) {
    const category = AppState.getCategory(t.categoryId);
    const account = AppState.getAccount(t.accountId);
    const fromAccount = t.fromAccountId ? AppState.getAccount(t.fromAccountId) : null;
    const toAccount = t.toAccountId ? AppState.getAccount(t.toAccountId) : null;
    const isSelected = AppState.selectedTransactions.has(t.id);
    const batchMode = AppState.batchMode;
    
    // 转账类型特殊处理
    let accountLabel = '';
    if (t.type === 'transfer' && fromAccount && toAccount) {
        accountLabel = `<span class="transaction-account">${fromAccount.name} → ${toAccount.name}</span>`;
    } else if (account) {
        accountLabel = `<span class="transaction-account">${account.name}</span>`;
    }
    
    // 转账金额显示
    let amountDisplay = formatAmount(t.amount, t.type);
    if (t.type === 'transfer') {
        amountDisplay = '⇄ ¥' + Math.abs(t.amount).toFixed(2);
    }
    
    return `
        <div class="transaction-item ${batchMode ? 'batch-mode' : ''} ${isSelected ? 'selected' : ''} ${t.type === 'transfer' ? 'transfer' : ''}" 
             onclick="${batchMode ? `toggleTransactionSelection('${t.id}', event)` : `showTransactionDetail('${t.id}')`}">
            ${batchMode ? `<input type="checkbox" class="transaction-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleTransactionSelection('${t.id}', event)">` : ''}
            <div class="transaction-icon" style="background: ${category ? category.color : (t.type === 'transfer' ? '#9C27B0' : '#9E9E9E')}">
                <i class="fas ${category ? category.icon : (t.type === 'transfer' ? 'fa-exchange-alt' : 'fa-question')}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-title">${t.counterparty || (t.type === 'transfer' ? '账户转账' : '未知商户')}</div>
                <div class="transaction-meta">
                    <span>${t.dateRaw || formatDate(t.date)}</span>
                    ${accountLabel}
                    ${!t.categoryId && t.type !== 'transfer' ? '<span class="transaction-badge">待处理</span>' : ''}
                    ${t.type === 'transfer' ? '<span class="transaction-badge transfer">转账</span>' : ''}
                </div>
            </div>
            <div class="transaction-amount">
                <span class="amount ${t.type}">${amountDisplay}</span>
                <span class="category ${t.categoryId ? '' : (t.type === 'transfer' ? '' : 'pending')}">${category ? category.name : (t.type === 'transfer' ? '账户互转' : '未分类')}</span>
            </div>
        </div>
    `;
}

// 【新增功能 3】渲染账单列表（支持账户筛选）
function renderTransactions() {
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    const accountFilter = document.getElementById('account-filter')?.value || 'all';
    
    let transactions = AppState.getTransactions();
    
    // 搜索过滤
    if (searchQuery) {
        transactions = transactions.filter(t => 
            (t.counterparty && t.counterparty.toLowerCase().includes(searchQuery)) ||
            (t.categoryRaw && t.categoryRaw.toLowerCase().includes(searchQuery)) ||
            (t.note && t.note.toLowerCase().includes(searchQuery))
        );
    }
    
    // 类型过滤
    if (typeFilter !== 'all') {
        transactions = transactions.filter(t => t.type === typeFilter);
    }
    
    // 【新增】账户过滤
    if (accountFilter !== 'all') {
        transactions = transactions.filter(t => t.accountId === accountFilter || t.fromAccountId === accountFilter || t.toAccountId === accountFilter);
        // 显示该账户的汇总信息
        showAccountSummary(accountFilter);
    } else {
        hideAccountSummary();
    }
    
    const container = document.getElementById('transaction-list');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>暂无交易记录</h3>
                <p>点击首页"导入账单"开始记账</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(t => renderTransactionItem(t)).join('');
}

// 【新增功能 3】显示账户汇总
function showAccountSummary(accountId) {
    var stats = AppState.getAccountStats(accountId);
    var account = AppState.getAccount(accountId);
    
    console.log('[账户统计] accountId:', accountId, 'stats:', JSON.stringify(stats), 'account:', account ? account.name : 'null');
    
    var panel = document.getElementById('account-stats-panel');
    if (panel) panel.style.display = 'grid';
    
    var el = function(id) { var e = document.getElementById(id); return e ? e : { textContent: '' }; };
    
    el('account-income').textContent = formatAmount(stats.income || 0, 'income');
    el('account-expense').textContent = formatAmount(stats.expense || 0, 'expense');
    el('account-balance').textContent = '￥' + (stats.balance || 0).toFixed(2);
    el('account-count').textContent = stats.count || 0;
}

// 【新增功能 3】隐藏账户汇总
function hideAccountSummary() {
    document.getElementById('account-stats-panel').style.display = 'none';
}

// 过滤交易
function filterTransactions() {
    renderTransactions();
}

// 切换月份
function changeMonth(delta) {
    AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() + delta);
    updateCurrentMonth();
    renderHome();
    if (document.getElementById('page-transactions').classList.contains('active')) {
        renderTransactions();
    }
    // 切换月份时同步更新费用分析（renderHome 内部已有调用，这里额外确保 DOM 就绪后执行）
    setTimeout(function() {
        if (typeof window.renderExpenseAnalysis === 'function') {
            window.renderExpenseAnalysis();
        }
    }, 400);
}

// 更新当前月份显示
function updateCurrentMonth() {
    const year = AppState.currentMonth.getFullYear();
    const month = AppState.currentMonth.getMonth() + 1;
    document.getElementById('current-month').textContent = year + '年' + month + '月';
    document.getElementById('current-month').textContent = year + '年' + month + '月';
}

// 批量操作功能
function enterBatchMode() {
    AppState.batchMode = true;
    AppState.selectedTransactions.clear();
    updateBatchUI();
    renderTransactions();
}

function cancelBatchMode() {
    AppState.batchMode = false;
    AppState.selectedTransactions.clear();
    updateBatchUI();
    renderTransactions();
}

function updateBatchUI() {
    const toolbar = document.getElementById('batch-toolbar');
    const enterBtn = document.getElementById('batch-enter');
    const selectAllCheckbox = document.getElementById('select-all');
    
    if (AppState.batchMode) {
        toolbar.style.display = 'flex';
        enterBtn.style.display = 'none';
        selectAllCheckbox.checked = false;
        updateSelectedCount();
    } else {
        toolbar.style.display = 'none';
        enterBtn.style.display = 'flex';
    }
}

function toggleTransactionSelection(transactionId, event) {
    event.stopPropagation();
    
    if (AppState.selectedTransactions.has(transactionId)) {
        AppState.selectedTransactions.delete(transactionId);
    } else {
        AppState.selectedTransactions.add(transactionId);
    }
    
    updateSelectedCount();
    renderTransactions();
}

function updateSelectedCount() {
    const count = AppState.selectedTransactions.size;
    document.getElementById('selected-count').textContent = count;
    
    const selectAllCheckbox = document.getElementById('select-all');
    const visibleIds = getVisibleTransactionIds();
    
    if (count === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (count === visibleIds.length && visibleIds.length > 0) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

function getVisibleTransactionIds() {
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    const accountFilter = document.getElementById('account-filter')?.value || 'all';
    
    let transactions = AppState.getTransactions();
    
    if (searchQuery) {
        transactions = transactions.filter(t => 
            (t.counterparty && t.counterparty.toLowerCase().includes(searchQuery)) ||
            (t.categoryRaw && t.categoryRaw.toLowerCase().includes(searchQuery)) ||
            (t.note && t.note.toLowerCase().includes(searchQuery))
        );
    }
    
    if (typeFilter !== 'all') {
        transactions = transactions.filter(t => t.type === typeFilter);
    }
    
    if (accountFilter !== 'all') {
        transactions = transactions.filter(t => t.accountId === accountFilter || t.fromAccountId === accountFilter || t.toAccountId === accountFilter);
    }

    return transactions.map(t => t.id);
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all');
    const visibleIds = getVisibleTransactionIds();
    
    if (selectAllCheckbox.checked) {
        visibleIds.forEach(id => AppState.selectedTransactions.add(id));
    } else {
        visibleIds.forEach(id => AppState.selectedTransactions.delete(id));
    }
    
    updateSelectedCount();
    renderTransactions();
}

function batchDelete() {
    if (AppState.selectedTransactions.size === 0) {
        showToast('请先勾选要删除的账单');
        return;
    }
    
    var deleteCount = AppState.selectedTransactions.size;
    showConfirm('确认删除？', '将删除选中的 ' + deleteCount + ' 条交易记录，账户余额将同步更新', function() {
        var transactions = AppState.getTransactions();
        transactions = transactions.filter(function(t) { return !AppState.selectedTransactions.has(t.id); });
        AppState.saveTransactions(transactions);
        AppState.selectedTransactions.clear();
        AppState.batchMode = false;
        updateBatchUI();
        refreshAllData();
        showToast('已删除 ' + deleteCount + ' 条账单，余额/统计已同步更新');
    });
}

// 初始化账户筛选器
function initAccountFilter() {
    const accountFilter = document.getElementById('account-filter');
    const accounts = AppState.getAccounts();
    
    accountFilter.innerHTML = '<option value="all">所有账户</option>';
    accounts.forEach(account => {
        accountFilter.innerHTML += `<option value="${account.id}">${account.name}</option>`;
    });
}

// 导入账单功能（保持原有逻辑）
let previewData = {
    transactions: [],
    errors: [],
    skipped: 0
};

function showImportModal() {
    const accounts = AppState.getAccounts();
    const accountSelect = document.getElementById('import-account');
    accountSelect.innerHTML = '<option value="">请选择账户...</option>';
    accounts.forEach(a => {
        accountSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
    document.getElementById('import-modal').classList.add('active');
}

function updateTemplateDesc() {
    const template = document.getElementById('import-template').value;
    const descEl = document.getElementById('template-desc');
    
    if (template === 'wechat') {
        descEl.innerHTML = `
            <strong>微信支付模板字段：</strong><br>
            交易时间 | 交易类型 | 交易对方 | 商品 | 收/支 | 金额 (元) | 支付方式 | 当前状态 | 交易单号 | 商户单号 | 备注
        `;
    } else if (template === 'alipay') {
        descEl.innerHTML = `
            <strong>支付宝模板字段：</strong><br>
            交易时间 | 交易分类 | 交易对方 | 对方账号 | 商品说明 | 收/支 | 金额 | 收/付款方式 | 交易状态 | 交易订单号 | 商家订单号 | 备注
        `;
    } else {
        descEl.innerHTML = '';
    }
}

function selectTemplateAndImport(type) {
    const template = document.getElementById('import-template').value;
    const accountId = document.getElementById('import-account').value;
    
    if (!accountId) {
        showToast('请先选择账户');
        return;
    }
    
    if (!template) {
        showToast('请先选择模板类型');
        const templateSelect = document.getElementById('import-template');
        templateSelect.style.borderColor = 'var(--danger-color)';
        setTimeout(() => {
            templateSelect.style.borderColor = 'var(--border-color)';
        }, 2000);
        return;
    }
    
    if (type === 'file') {
        importFromFile();
    } else if (type === 'paste') {
        showPasteImport();
    }
}

function importFromFile() {
    const accountId = document.getElementById('import-account').value;
    const template = document.getElementById('import-template').value;
    
    if (!accountId || !template) return;
    
    closeModal('import-modal');
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showToast(`正在解析：${file.name}`);
        
        const reader = new FileReader();
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        
        reader.onload = function(event) {
            if (isExcel) {
                parseExcelFilePreview(event.target.result, accountId, template);
            } else {
                parseCSVFilePreview(event.target.result, accountId, template);
            }
        };
        
        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };
    input.click();
}

// 预览和导入功能（简化版）
function parseExcelFilePreview(data, accountId, template) {
    try {
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        const transactions = [];
        let startRow = 1;
        
        for (let i = 0; i < Math.min(30, jsonData.length); i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            const firstCell = String(row[0] || '').trim();
            if (firstCell.includes('交易时间')) {
                startRow = i + 1;
                break;
            }
        }
        
        const headers = jsonData[startRow - 1].map(h => String(h || '').trim());
        
        for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const transaction = parseExcelRow(row, headers, accountId, template);
            if (transaction) {
                transactions.push(transaction);
            }
        }
        
        previewData = { transactions, errors: [], skipped: 0, accountId, fileType: template };
        showPreviewModal();
    } catch (err) {
        showToast('解析失败：' + err.message);
    }
}

function parseCSVFilePreview(content, accountId, template) {
    const lines = content.split('\n');
    const transactions = [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const transaction = parseCSVRowPreview(values, headers, accountId, template);
        if (transaction) {
            transactions.push(transaction);
        }
    }
    
    previewData = { transactions, errors: [], skipped: 0, accountId, fileType: template };
    showPreviewModal();
}

// 查找金额列（智能匹配）
function findAmountColumn(headers) {
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i] || '').trim();
        if (header.includes('金额') || header === 'Amount') {
            console.log('找到金额列:', header, '索引:', i);
            return i;
        }
    }
    console.warn('未找到金额列，headers:', headers);
    return -1;
}

// 解析金额值
function parseAmountValue(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Math.abs(value);
    const str = String(value).trim();
    if (!str || str === '' || str === '-') return 0;
    const cleaned = str.replace(/[￥￥,\s]/g, '');
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) {
        console.warn('金额解析失败:', str, '清理后:', cleaned);
        return 0;
    }
    return Math.abs(amount);
}

// 解析收支类型
function parseTransactionType(value, amount) {
    if (!value) return amount >= 0 ? 'income' : 'expense';
    const str = String(value).trim();
    if (str === '/' || str === '转账') return 'transfer';
    if (str.includes('收入') || str.includes('收款')) return 'income';
    if (str.includes('支出') || str.includes('付款')) return 'expense';
    return amount >= 0 ? 'income' : 'expense';
}

function parseExcelRow(row, headers, accountId, fileType) {
    const data = {};
    headers.forEach((header, index) => {
        data[header] = row[index];
    });

    // 智能查找列
    const amountIndex = findAmountColumn(headers);
    const typeIndex = headers.findIndex(h => String(h || '').includes('收/支') || String(h || '').includes('收支'));
    const timeIndex = headers.findIndex(h => String(h || '').includes('时间') || String(h || '').includes('日期'));
    const counterpartyIndex = headers.findIndex(h => String(h || '').includes('对方') || String(h || '').includes('商户'));

    if (timeIndex === -1 || amountIndex === -1 || counterpartyIndex === -1) {
        console.warn('缺少必要列:', { timeIndex, amountIndex, counterpartyIndex });
        return null;
    }

    // 获取值
    const timeValue = row[timeIndex];
    const amountValue = row[amountIndex];
    const typeValue = typeIndex !== -1 ? row[typeIndex] : null;
    const counterpartyValue = row[counterpartyIndex];

    // 解析
    let date = fileType === 'wechat' ? parseWechatDate(timeValue) : parseAlipayDate(timeValue);
    const parsedAmount = parseAmountValue(amountValue);
    const type = parseTransactionType(typeValue, parsedAmount);

    // 转账类型金额为负数
    const amount = type === 'transfer' ? -parsedAmount : parsedAmount;

    const counterparty = String(counterpartyValue || '').trim();

    if (!date || !counterparty || amount === 0) {
        console.warn('交易数据无效:', { date, counterparty, amount });
        return null;
    }

    return {
        id: generateId(),
        date: date.toISOString(),
        dateRaw: rawDateValue(timeValue, date),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false,
        categoryRaw: data['交易分类'] || data['商品'] || '',
        rawData: {
            fileType: fileType,
            tradeTime: rawDateValue(timeValue, date),
            tradeType: data['交易类型'] || data['交易分类'] || typeValue || '',
            counterpartyRaw: data['交易对方'] || data['对方'] || '',
            product: data['商品'] || data['商品说明'] || '',
            incomeExpense: data['收/支'] || data['收支'] || (typeValue || ''),
            amountRaw: String(amountValue || ''),
            payMethod: data['支付方式'] || data['收付款方式'] || ''
        }
    };
}

function parseCSVRow(row, headers, accountId, fileType) {
    const data = {};
    headers.forEach((header, index) => {
        data[header] = row[index];
    });
    
    let date, amount, type, counterparty;
    
    if (fileType === 'wechat') {
        date = parseWechatDate(data['交易时间']);
        amount = parseFloat(String(data['金额 (元)'] || data['金额'] || '').replace(/[￥￥,\s]/g, '')) || 0;
        var incomeExpenseType = String(data['收/支'] || '').trim();
        if (incomeExpenseType === '/' || incomeExpenseType === '转账') {
            type = 'transfer';
            amount = -Math.abs(amount);
        } else if (incomeExpenseType.includes('收入')) {
            type = 'income';
        } else {
            type = 'expense';
        }
        counterparty = String(data['交易对方'] || '').trim();
    } else if (fileType === 'alipay') {
        date = parseAlipayDate(data['交易时间']);
        amount = parseFloat(String(data['金额'] || '').replace(/[￥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    }
    
    if (!date || !counterparty) return null;
    
    return {
        id: generateId(),
        date: date.toISOString(),
        dateRaw: rawDateValue(data['交易时间'], date),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false,
        categoryRaw: data['商品'] || data['商品说明'] || '',
        rawData: {
            fileType: fileType,
            tradeTime: rawDateValue(data['交易时间'], date),
            tradeType: data['交易类型'] || data['交易分类'] || data['收/支'] || '',
            counterpartyRaw: data['交易对方'] || '',
            product: data['商品'] || data['商品说明'] || '',
            incomeExpense: data['收/支'] || '',
            amountRaw: String(data['金额 (元)'] || data['金额'] || ''),
            payMethod: data['支付方式'] || data['收付款方式'] || ''
        }
    };
}

function parseCSVRowPreview(values, headers, accountId, fileType) {
    const data = {};
    headers.forEach((header, index) => {
        data[header] = values[index] || '';
    });
    
    let date, amount, type, counterparty;
    
    if (fileType === 'wechat') {
        date = parseWechatDate(data['交易时间']);
        amount = parseFloat(String(data['金额 (元)'] || '').replace(/[￥￥,\s]/g, '')) || 0;
        var ieType = String(data['收/支'] || '').trim();
        if (ieType === '/' || ieType === '转账') {
            type = 'transfer';
            amount = -Math.abs(amount);
        } else if (ieType.includes('收入')) {
            type = 'income';
        } else {
            type = 'expense';
        }
        counterparty = String(data['交易对方'] || '').trim();
    } else if (fileType === 'alipay') {
        date = parseAlipayDate(data['交易时间']);
        amount = parseFloat(String(data['金额'] || '').replace(/[￥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    }
    
    if (!date || !counterparty) return null;
    
    return {
        id: generateId(),
        date: date.toISOString(),
        dateRaw: rawDateValue(data['交易时间'], date),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false,
        categoryRaw: data['商品'] || data['商品说明'] || '',
        rawData: {
            fileType: fileType,
            tradeTime: rawDateValue(data['交易时间'], date),
            tradeType: data['交易类型'] || data['交易分类'] || data['收/支'] || '',
            counterpartyRaw: data['交易对方'] || '',
            product: data['商品'] || data['商品说明'] || '',
            incomeExpense: data['收/支'] || '',
            amountRaw: String(data['金额 (元)'] || data['金额'] || ''),
            payMethod: data['支付方式'] || data['收付款方式'] || ''
        }
    };
}

function parseWechatDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'number') {
        // Excel序列日期 -> 使用本地时间纪元，避免UTC时区偏移
        var excelEpoch = new Date(1899, 11, 30);
        var days = Math.floor(dateValue);
        var frac = dateValue - days;
        var hours = Math.floor(frac * 24);
        var minutes = Math.floor((frac * 24 - hours) * 60);
        var seconds = Math.round(((frac * 24 - hours) * 60 - minutes) * 60);
        var baseDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, seconds);
    }
    var str = String(dateValue).trim();
    var match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (match) {
        return new Date(match[1] + '-' + String(match[2]).padStart(2,'0') + '-' + String(match[3]).padStart(2,'0') + 'T' + String(match[4]).padStart(2,'0') + ':' + String(match[5]).padStart(2,'0') + ':' + String(match[6]).padStart(2,'0'));
    }
    return new Date(str);
}

function parseAlipayDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'number') {
        // Excel序列日期 -> 使用本地时间纪元，避免UTC时区偏移
        var excelEpoch = new Date(1899, 11, 30);
        var days = Math.floor(dateValue);
        var frac = dateValue - days;
        var hours = Math.floor(frac * 24);
        var minutes = Math.floor((frac * 24 - hours) * 60);
        var seconds = Math.round(((frac * 24 - hours) * 60 - minutes) * 60);
        var baseDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, seconds);
    }
    var str = String(dateValue).trim();
    var match = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
    if (match) {
        return new Date(match[1] + '-' + String(match[2]).padStart(2,'0') + '-' + String(match[3]).padStart(2,'0') + 'T' + String(match[4]).padStart(2,'0') + ':' + String(match[5]).padStart(2,'0') + ':00');
    }
    return new Date(str);
}

function showPreviewModal() {
    document.getElementById('preview-success-count').textContent = previewData.transactions.length;
    document.getElementById('preview-error-count').textContent = previewData.errors.length;
    document.getElementById('preview-skip-count').textContent = previewData.skipped;
    
    const tbody = document.getElementById('preview-tbody');
    tbody.innerHTML = previewData.transactions.slice(0, 100).map(function(t) {
        var dateStr = t.dateRaw || formatDate(t.date);
        var amountStr;
        var amountColor;
        if (t.type === 'transfer') {
            amountStr = '-' + Math.abs(t.amount).toFixed(2);
            amountColor = 'var(--expense-color)';
        } else if (t.type === 'income') {
            amountStr = '+' + t.amount.toFixed(2);
            amountColor = 'var(--income-color)';
        } else {
            amountStr = '-' + Math.abs(t.amount).toFixed(2);
            amountColor = 'var(--expense-color)';
        }
        var rd = t.rawData || {};
        var account = AppState.getAccount(t.accountId);
        var typeDisplay = rd.incomeExpense || (t.type === 'income' ? '收入' : t.type === 'transfer' ? '转账' : '支出');
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${t.counterparty || '-'}</td>
                <td style="color: ${amountColor}">${amountStr}</td>
                <td>${typeDisplay}</td>
                <td>${rd.tradeType || rd.product || t.categoryRaw || '-'}</td>
                <td>${account ? account.name : '?'}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('preview-modal').classList.add('active');
}

// 【新增功能 1】确认导入后自动更新汇总
function confirmImport() {
    if (previewData.transactions.length === 0) {
        showToast('没有可导入的数据');
        return;
    }
    
    console.log('[导入确认] 将导入', previewData.transactions.length, '条, accountId:', previewData.accountId);
    previewData.transactions.forEach(function(t, i) {
        if (i < 3) console.log('  [' + i + ']', t.counterparty, t.amount, t.type, t.accountId);
    });
    
    const existingTransactions = AppState.getTransactions();
    AppState.saveTransactions([...previewData.transactions, ...existingTransactions]);
    
    closeModal('preview-modal');
    
    refreshAllData();
    initAccountFilter();
    showToast(`成功导入 ${previewData.transactions.length} 条记录`);
}

function recalculateAllAccountBalances() {
    var transactions = AppState.getTransactions();
    var accounts = AppState.getAccounts();
    
    console.log('[余额重算] 交易总数:', transactions.length, '账户数:', accounts.length);
    
    accounts.forEach(function(account) {
        var balance = 0;
        var txCount = 0;
        
        transactions.forEach(function(t) {
            var amt = Math.abs(parseFloat(t.amount)) || 0;
            
            if (t.type === 'transfer') {
                // 转账交易：转出账户扣款，转入账户加款
                if (t.fromAccountId === account.id) {
                    balance -= amt;
                    txCount++;
                }
                if (t.toAccountId === account.id) {
                    balance += amt;
                    txCount++;
                }
            } else if (t.accountId === account.id) {
                // 普通收入/支出交易
                txCount++;
                if (t.type === 'income') { balance += amt; }
                else if (t.type === 'expense') { balance -= amt; }
            }
        });
        
        account.balance = balance;
        console.log('[余额] ' + account.name + '(' + account.id + '): ' + txCount + '笔 → ￥' + balance.toFixed(2));
    });
    
    AppState.saveAccounts(accounts);
    console.log('[余额重算] 已保存到localStorage');
}

function refreshAllData() {
    recalculateAllAccountBalances();
    renderHome();
    renderPending();
    if (document.getElementById('page-transactions').classList.contains('active')) {
        renderTransactions();
    }
}

// 工具函数
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function showConfirm(title, message, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('active');
    
    document.getElementById('confirm-btn').onclick = () => {
        closeModal('confirm-modal');
        callback();
    };
}

var editingAccountId = null;
var editingCategoryId = null;
var editingRuleId = null;
var editingBudgetId = null;
var processingTransactionId = null;

function showAccountSettings() {
    renderAccountList();
    document.getElementById('account-settings-modal').classList.add('active');
}

function renderAccountList() {
    const accounts = AppState.getAccounts();
    const container = document.getElementById('account-list');
    if (accounts.length === 0) {
        container.innerHTML = '<div class="empty-list-placeholder"><i class="fas fa-credit-card"></i><p>暂无账户</p></div>';
        return;
    }

    const typeIcons = { alipay: 'fa-alipay', wechat: 'fa-weixin', bank: 'fa-credit-card', cash: 'fa-money-bill-wave', other: 'fa-wallet' };
    const typeNames = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡', cash: '现金', other: '其他' };

    container.innerHTML = accounts.map(function(a) {
        var icon = a.icon || typeIcons[a.type] || 'fa-wallet';
        var typeName = typeNames[a.type] || '';
        var balance = (a.balance || 0).toFixed(2);
        return '<div class="account-manage-card" style="border-left-color:' + a.color + '">' +
            '<div class="account-manage-card-icon" style="background:' + a.color + '">' +
                '<i class="fas ' + icon + '"></i>' +
            '</div>' +
            '<div class="account-manage-card-info">' +
                '<div class="account-manage-card-name">' + a.name + '</div>' +
                '<div class="account-manage-card-type">' + (typeName || '其他') + '</div>' +
            '</div>' +
            '<div class="account-manage-card-balance" style="color:' + a.color + '">¥' + balance + '</div>' +
            '<div class="account-manage-card-actions">' +
                '<button class="btn-icon-sm" onclick="editAccount(\'' + a.id + '\')" title="编辑"><i class="fas fa-pen"></i></button>' +
                '<button class="btn-icon-sm btn-icon-sm-danger" onclick="deleteAccount(\'' + a.id + '\')" title="删除"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function showAddAccountModal() {
    editingAccountId = null;
    document.getElementById('account-modal-title').textContent = '添加账户';
    document.getElementById('account-name').value = '';
    document.getElementById('account-type').value = 'alipay';
    document.getElementById('account-balance').value = '0';
    resetColorPicker('account-color-picker', '#2196F3');
    document.getElementById('account-modal').classList.add('active');
}

function editAccount(id) {
    const accounts = AppState.getAccounts();
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    editingAccountId = id;
    document.getElementById('account-modal-title').textContent = '编辑账户';
    document.getElementById('account-name').value = account.name;
    document.getElementById('account-type').value = account.type || 'other';
    document.getElementById('account-balance').value = account.balance || 0;
    resetColorPicker('account-color-picker', account.color || '#2196F3');
    document.getElementById('account-modal').classList.add('active');
}

function saveAccount() {
    const name = document.getElementById('account-name').value.trim();
    const type = document.getElementById('account-type').value;
    const balance = parseFloat(document.getElementById('account-balance').value) || 0;
    const color = getSelectedColor('account-color-picker') || '#2196F3';
    if (!name) { showToast('请输入账户名称'); return; }
    
    var accounts = AppState.getAccounts();
    if (editingAccountId) {
        var idx = accounts.findIndex(a => a.id === editingAccountId);
        if (idx !== -1) accounts[idx] = Object.assign(accounts[idx], { name, type, balance, color });
    } else {
        accounts.push({ id: generateId(), name, type, balance, color, icon: 'fa-credit-card' });
    }
    AppState.saveAccounts(accounts);
    closeModal('account-modal');
    renderAccountList();
    renderHome();
    showToast(editingAccountId ? '账户已更新' : '账户已添加');
}

function deleteAccount(id) {
    showConfirm('确认删除', '删除账户后相关交易将变为未指定账户', function() {
        var accounts = AppState.getAccounts().filter(a => a.id !== id);
        AppState.saveAccounts(accounts);
        renderAccountList();
        renderHome();
        showToast('账户已删除');
    });
}

function showCategorySettings() {
    // 确保分类数据已初始化
    ensureDefaultCategories();
    AppState.currentCategoryTab = 'expense';
    renderCategoryManageList();
    document.getElementById('category-settings-modal').classList.add('active');
}

// 确保默认分类存在
function ensureDefaultCategories() {
    let categories = Storage.get('categories');
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
        categories = [
            // 支出分类
            { id: '1', name: '餐饮', type: 'expense', icon: 'fa-utensils', color: '#FF9800' },
            { id: '2', name: '交通', type: 'expense', icon: 'fa-car', color: '#2196F3' },
            { id: '3', name: '购物', type: 'expense', icon: 'fa-shopping-bag', color: '#E91E63' },
            { id: '4', name: '娱乐', type: 'expense', icon: 'fa-gamepad', color: '#9C27B0' },
            { id: '5', name: '居住', type: 'expense', icon: 'fa-home', color: '#795548' },
            { id: '6', name: '医疗', type: 'expense', icon: 'fa-hospital', color: '#F44336' },
            { id: '7', name: '教育', type: 'expense', icon: 'fa-graduation-cap', color: '#4CAF50' },
            // 收入分类
            { id: '8', name: '工资', type: 'income', icon: 'fa-money-bill-wave', color: '#4CAF50' },
            { id: '9', name: '奖金', type: 'income', icon: 'fa-gift', color: '#F44336' },
            { id: '10', name: '投资', type: 'income', icon: 'fa-chart-line', color: '#2196F3' },
            // 转账分类
            { id: '11', name: '账户互转', type: 'transfer', icon: 'fa-exchange-alt', color: '#9C27B0' },
            // 默认分类
            { id: 'default', name: '默认分类', type: 'default', icon: 'fa-folder', color: '#607D8B' }
        ];
        Storage.set('categories', categories);
        console.log('[app.js] 已初始化默认分类:', categories.length, '个');
    }
}

function switchCategoryTab(tab) {
    AppState.currentCategoryTab = tab;
    document.querySelectorAll('#category-settings-modal .tab-btn').forEach(btn => {
        const btnText = btn.textContent;
        const isActive = (tab === 'expense' && btnText.includes('支出')) ||
                        (tab === 'income' && btnText.includes('收入')) ||
                        (tab === 'transfer' && btnText.includes('转账')) ||
                        (tab === 'default' && btnText.includes('默认'));
        btn.classList.toggle('active', isActive);
    });
    renderCategoryManageList();
}

function renderCategoryManageList() {
    const categories = AppState.getCategories().filter(c => c.type === AppState.currentCategoryTab);
    const container = document.getElementById('category-manage-list');
    if (categories.length === 0) {
        container.innerHTML = '<div class="empty-list-placeholder"><i class="fas fa-tags"></i><p>暂无分类</p></div>';
        return;
    }
    container.innerHTML = '<div class="category-manage-grid">' +
        categories.map(function(c) {
            return '<div class="category-manage-card">' +
                '<div class="category-manage-card-icon" style="background:' + c.color + '">' +
                    '<i class="fas ' + c.icon + '"></i>' +
                '</div>' +
                '<div class="category-manage-card-name" style="color:' + c.color + '">' + c.name + '</div>' +
                '<div class="category-manage-card-actions">' +
                    '<button class="btn-icon-sm" onclick="editCategory(\'' + c.id + '\')" title="编辑"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-icon-sm btn-icon-sm-danger" onclick="deleteCategory(\'' + c.id + '\')" title="删除"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</div>';
        }).join('') +
    '</div>';
}

function showAddCategoryModal() {
    editingCategoryId = null;
    document.getElementById('category-modal-title').textContent = '添加分类';
    document.getElementById('category-name').value = '';
    document.getElementById('category-type').value = AppState.currentCategoryTab;
    resetIconPicker('category-icon-picker', 'fa-utensils');
    resetColorPicker('category-color-picker', '#FF9800');
    document.getElementById('category-modal').classList.add('active');
}

function editCategory(id) {
    const categories = AppState.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    editingCategoryId = id;
    document.getElementById('category-modal-title').textContent = '编辑分类';
    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-type').value = cat.type;
    resetIconPicker('category-icon-picker', cat.icon);
    resetColorPicker('category-color-picker', cat.color);
    document.getElementById('category-modal').classList.add('active');
}

function saveCategory() {
    const name = document.getElementById('category-name').value.trim();
    const type = document.getElementById('category-type').value;
    const icon = getSelectedIcon('category-icon-picker') || 'fa-utensils';
    const color = getSelectedColor('category-color-picker') || '#FF9800';
    if (!name) { showToast('请输入分类名称'); return; }
    
    var categories = AppState.getCategories();
    if (editingCategoryId) {
        var idx = categories.findIndex(c => c.id === editingCategoryId);
        if (idx !== -1) categories[idx] = Object.assign(categories[idx], { name, icon, color });
    } else {
        categories.push({ id: generateId(), name, type, icon, color });
    }
    AppState.saveCategories(categories);
    closeModal('category-modal');
    renderCategoryManageList();
    renderHome();
    showToast(editingCategoryId ? '分类已更新' : '分类已添加');
}

function deleteCategory(id) {
    showConfirm('确认删除', '删除分类后使用该分类的交易将变为未分类', function() {
        var categories = AppState.getCategories().filter(c => c.id !== id);
        AppState.saveCategories(categories);
        renderCategoryManageList();
        renderHome();
        showToast('分类已删除');
    });
}

function showRuleSettings() {
    renderRuleList();
    document.getElementById('rule-settings-modal').classList.add('active');
}

function renderRuleList() {
    const rules = AppState.getRules();
    const container = document.getElementById('rule-list');
    if (rules.length === 0) {
        container.innerHTML = '<div class="empty-list-placeholder"><i class="fas fa-magic"></i><p>暂无规则，添加规则可自动分类账单</p></div>';
        return;
    }
    const fieldNames = { counterparty: '商户/对方', categoryRaw: '原始分类', note: '备注' };
    const matchNames = { contains: '包含', equals: '等于', startsWith: '开头是', endsWith: '结尾是' };

    container.innerHTML = rules.map(function(r) {
        const cat = AppState.getCategory(r.categoryId);
        const fieldName = fieldNames[r.field] || r.field || '';
        const matchName = matchNames[r.matchType] || r.matchType || '';
        const catColor = cat ? cat.color : '#999';
        const catIcon = cat ? cat.icon : 'fa-question';
        const catName = cat ? cat.name : '未知';
        return '<div class="rule-manage-card">' +
            '<div class="rule-manage-card-header">' +
                '<div class="rule-manage-card-icon"><i class="fas fa-magic"></i></div>' +
                '<div class="rule-manage-card-title">' + (r.name || '未命名规则') + '</div>' +
            '</div>' +
            '<div class="rule-manage-card-body">' +
                '<div class="rule-badge-inline">' +
                    '<span class="rule-badge-field">' + fieldName + '</span>' +
                    '<span class="rule-badge-arrow">→</span>' +
                    '<span class="rule-badge-keyword">"' + (r.keyword || '') + '"</span>' +
                    '<span class="rule-badge-arrow">→</span>' +
                '</div>' +
                '<div class="rule-category-result" style="background:' + catColor + '15;color:' + catColor + '">' +
                    '<i class="fas ' + catIcon + '"></i> ' + catName +
                '</div>' +
            '</div>' +
            '<div class="rule-manage-card-footer">' +
                '<button class="btn-text-sm" onclick="editRule(\'' + r.id + '\')"><i class="fas fa-pen"></i> 编辑</button>' +
                '<button class="btn-text-sm btn-text-sm-danger" onclick="deleteRule(\'' + r.id + '\')"><i class="fas fa-trash"></i> 删除</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function showAddRuleModal() {
    editingRuleId = null;
    document.getElementById('rule-modal-title').textContent = '添加规则';
    document.getElementById('rule-name').value = '';
    document.getElementById('rule-field').value = 'counterparty';
    document.getElementById('rule-match-type').value = 'contains';
    document.getElementById('rule-keyword').value = '';
    document.getElementById('rule-priority').value = '0';
    populateCategorySelect('rule-category');
    document.getElementById('rule-modal').classList.add('active');
}

function editRule(id) {
    const rules = AppState.getRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    editingRuleId = id;
    document.getElementById('rule-modal-title').textContent = '编辑规则';
    document.getElementById('rule-name').value = rule.name || '';
    document.getElementById('rule-field').value = rule.field || 'counterparty';
    document.getElementById('rule-match-type').value = rule.matchType || 'contains';
    document.getElementById('rule-keyword').value = rule.keyword || '';
    document.getElementById('rule-priority').value = rule.priority || 0;
    populateCategorySelect('rule-category', rule.categoryId);
    document.getElementById('rule-modal').classList.add('active');
}

function saveRule() {
    const name = document.getElementById('rule-name').value.trim();
    const field = document.getElementById('rule-field').value;
    const matchType = document.getElementById('rule-match-type').value;
    const keyword = document.getElementById('rule-keyword').value.trim();
    const categoryId = document.getElementById('rule-category').value;
    const priority = parseInt(document.getElementById('rule-priority').value) || 0;
    if (!keyword) { showToast('请输入匹配关键词'); return; }
    
    var rules = AppState.getRules();
    if (editingRuleId) {
        var idx = rules.findIndex(r => r.id === editingRuleId);
        if (idx !== -1) rules[idx] = Object.assign(rules[idx], { name, field, matchType, keyword, categoryId, priority });
    } else {
        rules.push({ id: generateId(), name, field, matchType, keyword, categoryId, priority });
    }
    AppState.saveRules(rules);
    closeModal('rule-modal');
    renderRuleList();
    showToast(editingRuleId ? '规则已更新' : '规则已添加');
}

function deleteRule(id) {
    showConfirm('确认删除', '确定要删除这条规则吗？', function() {
        var rules = AppState.getRules().filter(r => r.id !== id);
        AppState.saveRules(rules);
        renderRuleList();
        showToast('规则已删除');
    });
}

function showBudgetSettings() {
    renderBudgetManageList();
    document.getElementById('budget-settings-modal').classList.add('active');
}

function renderBudgetManageList() {
    const budgets = AppState.getBudgets();
    const container = document.getElementById('budget-manage-list');
    if (budgets.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">暂无预算设置</div>';
        return;
    }
    container.innerHTML = budgets.map(b => {
        const cat = b.categoryId ? AppState.getCategory(b.categoryId) : null;
        return `
        <div class="budget-manage-item">
            <div class="budget-manage-info">
                <span class="budget-manage-name">${cat ? cat.name : '总预算'} (${b.period === 'month' ? '月度' : '年度'})</span>
                <span class="budget-manage-amount">￥${b.amount.toFixed(2)}</span>
            </div>
            <div class="budget-manage-actions">
                <button class="btn-text" onclick="editBudget('${b.id}')">编辑</button>
                <button class="btn-text" onclick="deleteBudget('${b.id}')">删除</button>
            </div>
        </div>`;
    }).join('');
}

function showAddBudgetModal() {
    editingBudgetId = null;
    document.getElementById('budget-modal-title').textContent = '添加预算';
    document.getElementById('budget-type').value = 'total';
    document.getElementById('budget-category-group').style.display = 'none';
    document.getElementById('budget-period').value = 'month';
    document.getElementById('budget-amount').value = '';
    document.getElementById('budget-modal').classList.add('active');
    
    document.getElementById('budget-type').onchange = function() {
        document.getElementById('budget-category-group').style.display = this.value === 'category' ? 'block' : 'none';
        if (this.value === 'category') populateCategorySelect('budget-category');
    };
}

function editBudget(id) {
    const budgets = AppState.getBudgets();
    const budget = budgets.find(b => b.id === id);
    if (!budget) return;
    editingBudgetId = id;
    document.getElementById('budget-modal-title').textContent = '编辑预算';
    document.getElementById('budget-type').value = budget.categoryId ? 'category' : 'total';
    document.getElementById('budget-category-group').style.display = budget.categoryId ? 'block' : 'none';
    if (budget.categoryId) populateCategorySelect('budget-category', budget.categoryId);
    document.getElementById('budget-period').value = budget.period || 'month';
    document.getElementById('budget-amount').value = budget.amount || '';
    document.getElementById('budget-modal').classList.add('active');
    
    document.getElementById('budget-type').onchange = function() {
        document.getElementById('budget-category-group').style.display = this.value === 'category' ? 'block' : 'none';
        if (this.value === 'category') populateCategorySelect('budget-category');
    };
}

function saveBudget() {
    const type = document.getElementById('budget-type').value;
    const categoryId = type === 'category' ? document.getElementById('budget-category').value : null;
    const period = document.getElementById('budget-period').value;
    const amount = parseFloat(document.getElementById('budget-amount').value) || 0;
    if (amount <= 0) { showToast('请输入有效金额'); return; }
    
    var budgets = AppState.getBudgets();
    if (editingBudgetId) {
        var idx = budgets.findIndex(b => b.id === editingBudgetId);
        if (idx !== -1) budgets[idx] = Object.assign(budgets[idx], { categoryId, period, amount });
    } else {
        budgets.push({ id: generateId(), categoryId, period, amount });
    }
    AppState.saveBudgets(budgets);
    closeModal('budget-modal');
    renderBudgetManageList();
    renderHome();
    showToast(editingBudgetId ? '预算已更新' : '预算已添加');
}

function deleteBudget(id) {
    showConfirm('确认删除', '确定要删除这个预算吗？', function() {
        var budgets = AppState.getBudgets().filter(b => b.id !== id);
        AppState.saveBudgets(budgets);
        renderBudgetManageList();
        renderHome();
        showToast('预算已删除');
    });
}

function showDataSettings() {
    document.getElementById('data-transaction-count').textContent = AppState.getTransactions().length;
    document.getElementById('data-category-count').textContent = AppState.getCategories().length;
    document.getElementById('data-rule-count').textContent = AppState.getRules().length;
    document.getElementById('data-settings-modal').classList.add('active');
}

function exportData() {
    const data = {
        transactions: AppState.getTransactions(),
        categories: AppState.getCategories(),
        rules: AppState.getRules(),
        budgets: AppState.getBudgets(),
        accounts: AppState.getAccounts(),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-accounting-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据导出成功');
}

function importData(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions) AppState.saveTransactions(data.transactions);
            if (data.categories) AppState.saveCategories(data.categories);
            if (data.rules) AppState.saveRules(data.rules);
            if (data.budgets) AppState.saveBudgets(data.budgets);
            if (data.accounts) AppState.saveAccounts(data.accounts);
            renderHome();
            showToast('数据导入成功');
        } catch (err) {
            showToast('导入失败：文件格式错误');
        }
    };
    reader.readAsText(input.files[0]);
    input.value = '';
}

function clearAllData() {
    showConfirm('清空所有数据', '此操作将删除所有交易记录、分类、规则和预算，无法撤销！', function() {
        localStorage.clear();
        location.reload();
    });
}

function showProcessModal(transactionId) {
    // 确保分类数据已初始化
    ensureDefaultCategories();

    processingTransactionId = transactionId;
    var transactions = AppState.getTransactions();
    var t = transactions.find(function(tr) { return tr.id === transactionId; });
    if (!t) return;

    var rd = t.rawData || {};
    var isWechat = rd.fileType === 'wechat';
    var html = '<div class="process-preview-row"><span>交易时间：</span><strong>' + (t.dateRaw || formatDate(t.date)) + '</strong></div>';
    html += '<div class="process-preview-row"><span>交易对方：</span><strong>' + (t.counterparty || '-') + '</strong></div>';
    html += '<div class="process-preview-row"><span>金额(元)：</span><strong>' + formatAmount(t.amount, t.type) + '</strong></div>';

    if (isWechat) {
        html += '<div class="process-preview-row"><span>交易类型：</span><strong>' + (rd.tradeType || '-') + '</strong></div>';
        html += '<div class="process-preview-row"><span>商品：</span><strong>' + (rd.product || t.categoryRaw || '-') + '</strong></div>';
        html += '<div class="process-preview-row"><span>费用类型：</span><strong>' + (rd.incomeExpense || getTypeDisplayLabel(t.type)) + '</strong></div>';
        html += '<div class="process-preview-row"><span>支付方式：</span><strong>' + (rd.payMethod || '-') + '</strong></div>';
    } else {
        html += '<div class="process-preview-row"><span>交易分类：</span><strong>' + (rd.tradeType || '-') + '</strong></div>';
        html += '<div class="process-preview-row"><span>商品说明：</span><strong>' + (rd.product || '-') + '</strong></div>';
        html += '<div class="process-preview-row"><span>费用类型：</span><strong>' + (rd.incomeExpense || getTypeDisplayLabel(t.type)) + '</strong></div>';
        html += '<div class="process-preview-row"><span>收付款方式：</span><strong>' + (rd.payMethod || '-') + '</strong></div>';
    }

    document.getElementById('process-preview').innerHTML = html;

    // 设置默认类型为导入时识别的类型
    var detectedType = t.type || 'expense';
    document.getElementById('process-type').value = detectedType;

    // 初始化分类网格
    populateCategoryGrid('category-grid', detectedType);

    // 初始化账户选择器
    populateAccountSelect('process-to-account', '');
    populateAccountSelect('process-account', t.accountId || '');

    // 根据类型显示/隐藏字段
    toggleProcessTypeFields();

    document.getElementById('create-rule').checked = true;
    document.getElementById('process-modal').classList.add('active');
}

function populateCategoryGrid(containerId, type) {
    const categories = AppState.getCategories().filter(c => c.type === type);
    const container = document.getElementById(containerId);

    // 获取默认分类
    const defaultCategory = AppState.getCategories().find(c => c.id === 'default');

    // 将默认分类加入到列表最前面（如果当前类型没有默认分类的话）
    let displayCategories = [...categories];
    if (defaultCategory && !categories.find(c => c.id === 'default')) {
        displayCategories.unshift(defaultCategory);
    }

    container.innerHTML = displayCategories.map(c => `
        <div class="category-grid-item" data-id="${c.id}" onclick="selectProcessCategory(this, '${c.id}')"
             style="background:${c.color}20;border-color:${c.color}">
            <i class="fas ${c.icon}" style="color:${c.color}"></i>
            <span>${c.name}</span>
        </div>
    `).join('');

    // 默认选中"默认分类"
    if (defaultCategory) {
        selectedProcessCategoryId = 'default';
        setTimeout(() => {
            const defaultEl = container.querySelector('[data-id="default"]');
            if (defaultEl) defaultEl.classList.add('selected');
        }, 0);
    }
}

var selectedProcessCategoryId = null;

function selectProcessCategory(el, categoryId) {
    document.querySelectorAll('#category-grid .category-grid-item').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');
    selectedProcessCategoryId = categoryId;
}

// 根据处理账单的类型显示/隐藏相应字段
function toggleProcessTypeFields() {
    var type = document.getElementById('process-type').value;
    var categorySection = document.getElementById('process-category-section');
    var toAccountGroup = document.getElementById('process-to-account-group');
    var accountGroup = document.getElementById('process-account-group');
    var createRuleLabel = document.getElementById('process-create-rule-label');

    if (type === 'transfer') {
        // 转账：隐藏分类，显示转入账户和账户选择器
        if (categorySection) categorySection.style.display = 'none';
        if (toAccountGroup) toAccountGroup.style.display = 'block';
        if (accountGroup) accountGroup.style.display = 'block';
        if (createRuleLabel) createRuleLabel.style.display = 'none';
    } else {
        // 收入/支出：显示分类，隐藏转账字段
        if (categorySection) categorySection.style.display = 'block';
        if (toAccountGroup) toAccountGroup.style.display = 'none';
        if (accountGroup) accountGroup.style.display = 'block';
        if (createRuleLabel) createRuleLabel.style.display = 'flex';
        // 重新填充对应类型的分类
        populateCategoryGrid('category-grid', type);
    }
}

function saveTransaction() {
    var type = document.getElementById('process-type').value;

    if (!processingTransactionId) {
        showToast('处理账单出错'); return;
    }

    var transactions = AppState.getTransactions();
    var idx = transactions.findIndex(function(t) { return t.id === processingTransactionId; });
    if (idx === -1) return;

    if (type === 'transfer') {
        // 转账类型验证
        var toAccountId = document.getElementById('process-to-account').value;
        var fromAccountId = document.getElementById('process-account').value;

        if (!fromAccountId) { showToast('请选择账户（转出）'); return; }
        if (!toAccountId) { showToast('请选择转入账户'); return; }
        if (fromAccountId === toAccountId) { showToast('转出和转入账户不能相同'); return; }

        // 获取金额（原始数据中的金额视为正数）
        var originalAmount = Math.abs(parseFloat(transactions[idx].amount)) || 0;
        if (originalAmount <= 0) { showToast('账单金额无效'); return; }

        // 更新账户余额
        var accounts = AppState.getAccounts();
        var fromAcc = accounts.find(function(a) { return a.id === fromAccountId; });
        var toAcc = accounts.find(function(a) { return a.id === toAccountId; });
        if (fromAcc) fromAcc.balance -= originalAmount;
        if (toAcc) toAcc.balance += originalAmount;
        AppState.saveAccounts(accounts);

        // 更新交易数据
        transactions[idx].type = 'transfer';
        transactions[idx].categoryId = '11'; // 账户互转分类
        transactions[idx].fromAccountId = fromAccountId;
        transactions[idx].toAccountId = toAccountId;
        transactions[idx].accountId = fromAccountId;
        transactions[idx].counterparty = transactions[idx].counterparty || '账户转账';
        transactions[idx].isMatched = true;
    } else {
        // 收入/支出类型
        if (!selectedProcessCategoryId) {
            showToast('请选择一个分类'); return;
        }

        transactions[idx].categoryId = selectedProcessCategoryId;
        transactions[idx].type = type;
        transactions[idx].isMatched = true;

        // 更新账户
        var accountId = document.getElementById('process-account').value;
        if (accountId) {
            transactions[idx].accountId = accountId;
        }

        // 创建自动规则
        if (document.getElementById('create-rule').checked && transactions[idx].counterparty) {
            var rules = AppState.getRules();
            rules.push({
                id: generateId(),
                name: transactions[idx].counterparty + '自动分类',
                field: 'counterparty',
                matchType: 'contains',
                keyword: transactions[idx].counterparty,
                categoryId: selectedProcessCategoryId,
                priority: 0
            });
            AppState.saveRules(rules);
        }
    }

    AppState.saveTransactions(transactions);
    closeModal('process-modal');
    processingTransactionId = null;
    selectedProcessCategoryId = null;
    refreshAllData();
    showToast('账单已处理');
}

function batchProcess() {
    const pending = AppState.getPendingTransactions();
    if (pending.length === 0) { showToast('没有待处理的账单'); return; }
    
    var processed = 0;
    pending.forEach(t => {
        var rules = AppState.getRules();
        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            var value = String(t[r.field] || t.counterparty || '');
            var matched = false;
            if (r.matchType === 'contains' && value.includes(r.keyword)) matched = true;
            else if (r.matchType === 'equals' && value === r.keyword) matched = true;
            else if (r.matchType === 'startsWith' && value.startsWith(r.keyword)) matched = true;
            else if (r.matchType === 'endsWith' && value.endsWith(r.keyword)) matched = true;
            
            if (matched) {
                var transactions = AppState.getTransactions();
                var idx = transactions.findIndex(tr => tr.id === t.id);
                if (idx !== -1) {
                    transactions[idx].categoryId = r.categoryId;
                    transactions[idx].isMatched = true;
                    AppState.saveTransactions(transactions);
                    processed++;
                }
                break;
            }
        }
    });
    
    refreshAllData();
    showToast(processed > 0 ? `已自动处理 ${processed} 条账单` : '未能自动匹配，请手动处理');
}

function showTransactionDetail(transactionId) {
    AppState.selectedTransaction = transactionId;
    var transactions = AppState.getTransactions();
    var t = transactions.find(function(tr) { return tr.id === transactionId; });
    if (!t) return;
    
    var category = AppState.getCategory(t.categoryId);
    var account = AppState.getAccount(t.accountId);
    var rd = t.rawData || {};
    var isWechat = rd.fileType === 'wechat';
    
    var html = '<div class="detail-row"><span class="detail-label">交易时间</span><span class="detail-value">' + (t.dateRaw || formatDate(t.date)) + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">交易对方</span><span class="detail-value">' + (t.counterparty || '-') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">金额(元)</span><span class="detail-value ' + t.type + '">' + formatAmount(t.amount, t.type) + '</span></div>';
    
    if (isWechat) {
        html += '<div class="detail-row"><span class="detail-label">交易类型</span><span class="detail-value">' + (rd.tradeType || '-') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">商品</span><span class="detail-value">' + (rd.product || t.categoryRaw || '-') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">费用类型</span><span class="detail-value">' + (rd.incomeExpense || getTypeDisplayLabel(t.type)) + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">支付方式</span><span class="detail-value">' + (rd.payMethod || '-') + '</span></div>';
    } else {
        html += '<div class="detail-row"><span class="detail-label">交易分类</span><span class="detail-value">' + (rd.tradeType || '-') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">商品说明</span><span class="detail-value">' + (rd.product || '-') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">费用类型</span><span class="detail-value">' + (rd.incomeExpense || getTypeDisplayLabel(t.type)) + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">收付款方式</span><span class="detail-value">' + (rd.payMethod || '-') + '</span></div>';
    }
    
    html += '<div class="detail-row"><span class="detail-label">系统分类</span><span class="detail-value">' + (category ? category.name : '未分类') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">账户</span><span class="detail-value">' + (account ? account.name : '未指定') + '</span></div>';
    if (t.note) { html += '<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">' + t.note + '</span></div>'; }

    // 如果是转账，显示转出/转入账户详情
    if (t.type === 'transfer') {
        var fromAcc = t.fromAccountId ? AppState.getAccount(t.fromAccountId) : null;
        var toAcc = t.toAccountId ? AppState.getAccount(t.toAccountId) : null;
        html += '<div class="detail-row"><span class="detail-label">转出账户</span><span class="detail-value">' + (fromAcc ? fromAcc.name : '未知') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">转入账户</span><span class="detail-value">' + (toAcc ? toAcc.name : '未知') + '</span></div>';
        html += '<div class="detail-row"><span class="detail-label">转账金额</span><span class="detail-value transfer">¥' + Math.abs(t.amount).toFixed(2) + '</span></div>';
    }
    
    document.getElementById('detail-content').innerHTML = html;
    document.getElementById('detail-modal').classList.add('active');
}

function deleteTransaction() {
    if (!AppState.selectedTransaction) return;
    showConfirm('确认删除', '删除后无法恢复', function() {
        var transactions = AppState.getTransactions();
        var transaction = transactions.find(t => t.id === AppState.selectedTransaction);
        
        // 如果是转账交易，需要回滚账户余额
        if (transaction && transaction.type === 'transfer') {
            var accounts = AppState.getAccounts();
            var fromAccount = accounts.find(a => a.id === transaction.fromAccountId);
            var toAccount = accounts.find(a => a.id === transaction.toAccountId);
            
            if (fromAccount) {
                fromAccount.balance += Math.abs(transaction.amount); // 回滚转出
            }
            if (toAccount) {
                toAccount.balance -= Math.abs(transaction.amount); // 回滚转入
            }
            
            AppState.saveAccounts(accounts);
            console.log('[删除转账] 已回滚余额：' + transaction.fromAccountId + ' +' + transaction.amount + ', ' + transaction.toAccountId + ' -' + transaction.amount);
        }
        
        transactions = transactions.filter(t => t.id !== AppState.selectedTransaction);
        AppState.saveTransactions(transactions);
        closeModal('detail-modal');
        AppState.selectedTransaction = null;
        refreshAllData();
        showToast('账单已删除');
    });
}

function showEditTransactionModal() {
    if (!AppState.selectedTransaction) return;
    const transactions = AppState.getTransactions();
    const t = transactions.find(tr => tr.id === AppState.selectedTransaction);
    if (!t) return;

    document.getElementById('edit-amount').value = Math.abs(t.amount).toFixed(2);
    document.getElementById('edit-type').value = t.type;
    document.getElementById('edit-counterparty').value = t.counterparty || '';
    populateCategorySelect('edit-category', t.categoryId);
    populateAccountSelect('edit-account', t.accountId);

    // 处理转账类型的额外字段
    if (t.type === 'transfer') {
        populateAccountSelect('edit-from-account', t.fromAccountId);
        populateAccountSelect('edit-to-account', t.toAccountId);
    }

    // 处理日期时间 - 转换为 datetime-local 格式
    if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            document.getElementById('edit-date').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            document.getElementById('edit-date').value = '';
        }
    } else {
        document.getElementById('edit-date').value = '';
    }

    document.getElementById('edit-note').value = t.note || '';

    // 根据类型显示/隐藏相应字段
    toggleEditTypeFields();

    closeModal('detail-modal');
    document.getElementById('edit-transaction-modal').classList.add('active');
}

// 根据交易类型显示/隐藏相应字段
function toggleEditTypeFields() {
    const type = document.getElementById('edit-type').value;
    const counterpartyGroup = document.getElementById('edit-counterparty-group');
    const fromAccountGroup = document.getElementById('edit-from-account-group');
    const toAccountGroup = document.getElementById('edit-to-account-group');
    const categoryGroup = document.getElementById('edit-category-group');
    const accountGroup = document.getElementById('edit-account-group');

    if (type === 'transfer') {
        // 转账：显示转出/转入账户，隐藏商户和分类
        if (counterpartyGroup) counterpartyGroup.style.display = 'none';
        if (fromAccountGroup) fromAccountGroup.style.display = 'block';
        if (toAccountGroup) toAccountGroup.style.display = 'block';
        if (categoryGroup) categoryGroup.style.display = 'none';
        if (accountGroup) accountGroup.style.display = 'none';
    } else {
        // 收入/支出：显示商户、分类、账户，隐藏转账字段
        if (counterpartyGroup) counterpartyGroup.style.display = 'block';
        if (fromAccountGroup) fromAccountGroup.style.display = 'none';
        if (toAccountGroup) toAccountGroup.style.display = 'none';
        if (categoryGroup) categoryGroup.style.display = 'block';
        if (accountGroup) accountGroup.style.display = 'block';
    }
}

function saveEditTransaction() {
    if (!AppState.selectedTransaction) return;

    const amount = parseFloat(document.getElementById('edit-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效金额');
        return;
    }

    const type = document.getElementById('edit-type').value;
    const dateValue = document.getElementById('edit-date').value;
    const note = document.getElementById('edit-note').value.trim();

    // 处理日期
    let newDate = null;
    if (dateValue) {
        newDate = new Date(dateValue);
        if (isNaN(newDate.getTime())) {
            showToast('日期格式无效');
            return;
        }
    }

    var transactions = AppState.getTransactions();
    var idx = transactions.findIndex(t => t.id === AppState.selectedTransaction);
    if (idx === -1) return;

    var original = transactions[idx];
    var updated = Object.assign({}, original);

    // 根据类型构建更新数据
    if (type === 'transfer') {
        const fromAccountId = document.getElementById('edit-from-account').value;
        const toAccountId = document.getElementById('edit-to-account').value;

        if (!fromAccountId || !toAccountId) {
            showToast('请选择转出和转入账户');
            return;
        }
        if (fromAccountId === toAccountId) {
            showToast('转出和转入账户不能相同');
            return;
        }

        // 处理账户余额
        var accounts = AppState.getAccounts();

        // 回滚原来的交易
        if (original.type === 'transfer') {
            var fromOrig = accounts.find(a => a.id === original.fromAccountId);
            var toOrig = accounts.find(a => a.id === original.toAccountId);
            if (fromOrig) fromOrig.balance += Math.abs(original.amount);
            if (toOrig) toOrig.balance -= Math.abs(original.amount);
        } else {
            var origAccount = accounts.find(a => a.id === original.accountId);
            if (origAccount) {
                if (original.type === 'income') origAccount.balance -= Math.abs(original.amount);
                else if (original.type === 'expense') origAccount.balance += Math.abs(original.amount);
            }
        }

        // 应用新的转账
        var fromNew = accounts.find(a => a.id === fromAccountId);
        var toNew = accounts.find(a => a.id === toAccountId);
        if (fromNew) fromNew.balance -= amount;
        if (toNew) toNew.balance += amount;

        AppState.saveAccounts(accounts);

        updated.type = 'transfer';
        updated.amount = Math.abs(amount);
        updated.fromAccountId = fromAccountId;
        updated.toAccountId = toAccountId;
        updated.counterparty = '账户转账';
        updated.categoryId = '11'; // 账户互转分类
        updated.accountId = fromAccountId;
    } else {
        const counterparty = document.getElementById('edit-counterparty').value.trim();
        if (!counterparty) {
            showToast('请输入商户名称');
            return;
        }
        const categoryId = document.getElementById('edit-category').value;
        const accountId = document.getElementById('edit-account').value;

        // 处理账户余额
        var accounts2 = AppState.getAccounts();

        // 回滚原来的交易
        if (original.type === 'transfer') {
            var fromOrig2 = accounts2.find(a => a.id === original.fromAccountId);
            var toOrig2 = accounts2.find(a => a.id === original.toAccountId);
            if (fromOrig2) fromOrig2.balance += Math.abs(original.amount);
            if (toOrig2) toOrig2.balance -= Math.abs(original.amount);
        } else {
            var oldAccount = accounts2.find(a => a.id === original.accountId);
            if (oldAccount) {
                if (original.type === 'income') oldAccount.balance -= Math.abs(original.amount);
                else if (original.type === 'expense') oldAccount.balance += Math.abs(original.amount);
            }
        }

        // 应用新的交易
        var newAccount = accounts2.find(a => a.id === accountId);
        if (newAccount) {
            if (type === 'income') newAccount.balance += amount;
            else if (type === 'expense') newAccount.balance -= amount;
        }

        AppState.saveAccounts(accounts2);

        updated.type = type;
        updated.amount = type === 'income' ? Math.abs(amount) : -Math.abs(amount);
        updated.counterparty = counterparty;
        updated.categoryId = categoryId;
        updated.accountId = accountId;
        // 清除转账字段
        delete updated.fromAccountId;
        delete updated.toAccountId;
    }

    if (newDate) {
        updated.date = newDate.toISOString();
    }
    updated.note = note;

    transactions[idx] = updated;
    AppState.saveTransactions(transactions);
    closeModal('edit-transaction-modal');
    AppState.selectedTransaction = null;
    refreshAllData();
    showToast('账单已更新');
}

function populateCategorySelect(selectId, selectedId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const categories = AppState.getCategories();
    select.innerHTML = '<option value="">选择分类...</option>' +
        categories.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`).join('');
}

function populateAccountSelect(selectId, selectedId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const accounts = AppState.getAccounts();
    select.innerHTML = '<option value="">选择账户...</option>' +
        accounts.map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${a.name}</option>`).join('');
}

function initAccountFilter() {
    populateAccountSelect('account-filter');
    populateAccountSelect('import-account');
}

function resetColorPicker(pickerId, defaultColor) {
    document.querySelectorAll(`#${pickerId} .color-option`).forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === defaultColor);
    });
}

function resetIconPicker(pickerId, defaultIcon) {
    document.querySelectorAll(`#${pickerId} .icon-option`).forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === defaultIcon);
    });
}

function getSelectedColor(pickerId) {
    const selected = document.querySelector(`#${pickerId} .color-option.selected`);
    return selected ? selected.dataset.color : null;
}

function getSelectedIcon(pickerId) {
    const selected = document.querySelector(`#${pickerId} .icon-option.selected`);
    return selected ? selected.dataset.icon : null;
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('color-option')) {
        e.target.parentElement.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        e.target.classList.add('selected');
    }
    if (e.target.classList.contains('icon-option')) {
        e.target.parentElement.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        e.target.classList.add('selected');
    }
});

// 渲染待处理列表
function renderPending() {
    const pending = AppState.getPendingTransactions();
    const container = document.getElementById('pending-list');
    document.getElementById('pending-badge').textContent = pending.length;
    document.getElementById('nav-badge').textContent = pending.length;

    if (pending.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>全部已处理</h3>
                <p>太棒了，所有账单都已分类</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pending.map(t => {
        const category = AppState.getCategory(t.categoryId);
        const categoryLabel = category ? category.name : '未分类';
        return `
        <div class="pending-item" onclick="showProcessModal('${t.id}')">
            <div class="pending-content">
                <div class="pending-title">${t.counterparty || '未知商户'}</div>
                <div class="pending-meta">${t.dateRaw || formatDate(t.date)} · ${t.categoryRaw || categoryLabel}</div>
            </div>
            <div class="pending-amount">
                <span class="amount ${t.type}">${formatAmount(t.amount, t.type)}</span>
            </div>
            <button class="btn-primary" onclick="event.stopPropagation(); showProcessModal('${t.id}')">处理</button>
        </div>
    `;
    }).join('');
}

// ===== 新建转账功能 =====

// 显示新建转账弹窗
function showNewTransferModal() {
    const accounts = AppState.getAccounts();

    // 填充转出账户下拉框
    const fromSelect = document.getElementById('transfer-from-account');
    fromSelect.innerHTML = '<option value="">请选择转出账户...</option>' +
        accounts.map(function(a) {
            return '<option value="' + a.id + '">' + a.name + ' (余额: ¥' + (a.balance || 0).toFixed(2) + ')</option>';
        }).join('');

    // 填充转入账户下拉框
    const toSelect = document.getElementById('transfer-to-account');
    toSelect.innerHTML = '<option value="">请选择转入账户...</option>' +
        accounts.map(function(a) {
            return '<option value="' + a.id + '">' + a.name + ' (余额: ¥' + (a.balance || 0).toFixed(2) + ')</option>';
        }).join('');

    // 设置默认日期为当前时间
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('transfer-date').value = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;

    // 清空金额和备注
    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-note').value = '';

    document.getElementById('transfer-modal').classList.add('active');
}

// 对调转出/转入账户
function swapTransferAccounts() {
    var fromSelect = document.getElementById('transfer-from-account');
    var toSelect = document.getElementById('transfer-to-account');
    var tempValue = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tempValue;
}

// 保存新建转账
function saveNewTransfer() {
    var fromAccountId = document.getElementById('transfer-from-account').value;
    var toAccountId = document.getElementById('transfer-to-account').value;
    var amount = parseFloat(document.getElementById('transfer-amount').value);
    var dateValue = document.getElementById('transfer-date').value;
    var note = document.getElementById('transfer-note').value.trim();

    // 验证
    if (!fromAccountId) { showToast('请选择转出账户'); return; }
    if (!toAccountId) { showToast('请选择转入账户'); return; }
    if (fromAccountId === toAccountId) { showToast('转出和转入账户不能相同'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); return; }

    // 检查转出账户余额
    var fromAccount = AppState.getAccount(fromAccountId);
    var toAccount = AppState.getAccount(toAccountId);

    if (fromAccount && (fromAccount.balance || 0) < amount) {
        var newBalance = ((fromAccount.balance || 0) - amount).toFixed(2);
        showConfirm('余额不足警告',
            fromAccount.name + ' 当前余额 ¥' + (fromAccount.balance || 0).toFixed(2) + '，转账金额 ¥' + amount.toFixed(2) + '，转账后余额将为 ¥' + newBalance + '。是否继续？',
            function() { executeTransfer(fromAccountId, toAccountId, amount, dateValue, note, fromAccount, toAccount); }
        );
        return;
    }

    executeTransfer(fromAccountId, toAccountId, amount, dateValue, note, fromAccount, toAccount);
}

// 执行转账
function executeTransfer(fromAccountId, toAccountId, amount, dateValue, note, fromAccount, toAccount) {
    // 更新账户余额
    var accounts = AppState.getAccounts();
    var fromAcc = accounts.find(function(a) { return a.id === fromAccountId; });
    var toAcc = accounts.find(function(a) { return a.id === toAccountId; });

    if (fromAcc) fromAcc.balance -= amount;
    if (toAcc) toAcc.balance += amount;
    AppState.saveAccounts(accounts);

    // 创建转账交易记录
    var date = dateValue ? new Date(dateValue) : new Date();
    var fromName = fromAccount ? fromAccount.name : (AppState.getAccount(fromAccountId) || {}).name || '未知';
    var toName = toAccount ? toAccount.name : (AppState.getAccount(toAccountId) || {}).name || '未知';

    var transaction = {
        id: generateId(),
        date: date.toISOString(),
        dateRaw: formatDisplayDate(date),
        amount: Math.abs(amount),
        type: 'transfer',
        counterparty: '账户转账',
        categoryId: '11',
        fromAccountId: fromAccountId,
        toAccountId: toAccountId,
        accountId: fromAccountId,
        note: note || '',
        isMatched: true,
        categoryRaw: '',
        rawData: {
            fileType: 'manual',
            tradeTime: formatDisplayDate(date),
            tradeType: '转账',
            counterpartyRaw: '',
            product: fromName + ' → ' + toName,
            incomeExpense: '转账',
            amountRaw: String(amount),
            payMethod: ''
        }
    };

    AppState.addTransaction(transaction);
    closeModal('transfer-modal');
    refreshAllData();

    showToast('转账成功：' + fromName + ' → ' + toName + ' ¥' + amount.toFixed(2));
}

// 初始化
  // 初始化
  function init() {
      console.log('开始初始化应用...');
      try {
          const year = AppState.currentMonth.getFullYear();
          const month = AppState.currentMonth.getMonth() + 1;
          const monthElement = document.getElementById('current-month');
          if (monthElement) {
              monthElement.textContent = year + '年' + month + '月';
          }
          
          initSampleData();
          migrateOldData();
          initAccountFilter();
          renderHome();
          
          hideSplashScreen();
      } catch (error) {
          console.error('初始化过程中出错:', error);
          hideSplashScreen();
      }
  }
  
  function hideSplashScreen() {
      console.log('隐藏启动页...');
      const splash = document.getElementById('splash-screen');
      const app = document.getElementById('app');
      
      if (splash) {
          splash.classList.add('hidden');
          setTimeout(function() {
              if (splash && splash.parentNode) {
                  splash.style.display = 'none';
              }
          }, 600);
      }
      if (app) {
          app.classList.remove('hidden');
      }
      console.log('启动页已隐藏，主应用已显示');
  }

// 初始化示例数据
function initSampleData() {
    if (Storage.get('sample_data_cleared')) return;
    var transactions = AppState.getTransactions();
    var isSampleData = transactions.length === 3 &&
        transactions.some(function(t) { return t.counterparty === '工资收入' && t.amount === 12580; }) &&
        transactions.some(function(t) { return t.counterparty === '麦当劳' && t.amount === 35.5; }) &&
        transactions.some(function(t) { return t.counterparty === '滴滴出行' && t.amount === 128; });
    if (isSampleData) {
        AppState.saveTransactions([]);
        Storage.set('sample_data_cleared', true);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，开始初始化...');
    
    var forceShowTimeout = setTimeout(function() {
        console.log('超时保护：强制显示主应用');
        hideSplashScreen();
    }, 3000);
    
    try {
        init();
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化失败:', error);
        hideSplashScreen();
    }
    
    clearTimeout(forceShowTimeout);
});


// V5 交互优化 - 添加点击事件调试
document.addEventListener('click', function(e) {
    console.log('点击事件:', e.target.tagName, e.target.className);
}, true);

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.message, e.filename, e.lineno);
});

// 确保所有按钮都可点击
document.addEventListener('DOMContentLoaded', function() {
    console.log('V5 优化版已加载');
    
    // 为所有按钮添加点击反馈
    document.querySelectorAll('button, .btn-import, .btn-icon').forEach(function(btn) {
        btn.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        });
        btn.addEventListener('touchend', function() {
            this.style.opacity = '';
        });
    });
});











