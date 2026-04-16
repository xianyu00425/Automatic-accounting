// 自动记账 V3 增强版 - JavaScript
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
    return `${prefix}¥${parseFloat(amount).toFixed(2)}`;
}

// 格式化日期
function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return '无效日期';
    }
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// 应用状态管理
const AppState = {
    currentMonth: new Date(),
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
            { id: '1', name: '餐饮', type: 'expense', icon: 'fa-utensils', color: '#FF9800' },
            { id: '2', name: '交通', type: 'expense', icon: 'fa-car', color: '#2196F3' },
            { id: '3', name: '购物', type: 'expense', icon: 'fa-shopping-bag', color: '#E91E63' },
            { id: '4', name: '娱乐', type: 'expense', icon: 'fa-gamepad', color: '#9C27B0' },
            { id: '5', name: '居住', type: 'expense', icon: 'fa-home', color: '#795548' },
            { id: '6', name: '医疗', type: 'expense', icon: 'fa-hospital', color: '#F44336' },
            { id: '7', name: '教育', type: 'expense', icon: 'fa-graduation-cap', color: '#4CAF50' },
            { id: '8', name: '工资', type: 'income', icon: 'fa-money-bill-wave', color: '#4CAF50' },
            { id: '9', name: '奖金', type: 'income', icon: 'fa-gift', color: '#F44336' },
            { id: '10', name: '投资', type: 'income', icon: 'fa-chart-line', color: '#2196F3' },
        ];
        return Storage.get('categories') || defaultCategories;
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
    
    // 【新增功能 1】获取本月统计（自动更新）
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
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
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
    
    // 【新增功能 3】获取指定账户的交易统计
    getAccountStats(accountId) {
        const transactions = this.getTransactions();
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        const accountTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            return t.accountId === accountId && 
                   date.getFullYear() === year && 
                   date.getMonth() === month;
        });
        
        const income = accountTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = accountTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        return {
            income,
            expense,
            balance: income - expense
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
    // 更新本月统计（自动计算）
    const stats = AppState.getMonthlyStats();
    document.getElementById('month-income').textContent = formatAmount(stats.income, 'income');
    document.getElementById('month-expense').textContent = formatAmount(stats.expense, 'expense');
    document.getElementById('month-balance').textContent = `¥${stats.balance.toFixed(2)}`;
    
    // 【新增】更新总账户余额
    const totalBalance = AppState.getTotalBalance();
    document.getElementById('total-balance').textContent = `¥${totalBalance.toFixed(2)}`;
    
    // 【新增】更新账户数量
    const accounts = AppState.getAccounts();
    document.getElementById('account-count').textContent = `${accounts.length}个账户`;
    
    // 更新待处理提醒
    const pending = AppState.getPendingTransactions();
    const pendingAlert = document.getElementById('pending-alert');
    if (pending.length > 0) {
        pendingAlert.style.display = 'flex';
        document.getElementById('pending-count').textContent = pending.length;
    } else {
        pendingAlert.style.display = 'none';
    }
    
    renderBudgets();
    renderRecentTransactions();
}

// 渲染预算
function renderBudgets() {
    const budgets = AppState.getBudgets();
    const transactions = AppState.getTransactions();
    const container = document.getElementById('budget-list');
    
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
                    <span class="budget-amount">¥${spend.toFixed(0)} / ¥${budget.amount.toFixed(0)}</span>
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
        .reduce((sum, t) => sum + t.amount, 0);
}

// 渲染最近交易
function renderRecentTransactions() {
    const transactions = AppState.getTransactions().slice(0, 5);
    const container = document.getElementById('recent-transactions');
    
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
    const isSelected = AppState.selectedTransactions.has(t.id);
    const batchMode = AppState.batchMode;
    
    return `
        <div class="transaction-item ${batchMode ? 'batch-mode' : ''} ${isSelected ? 'selected' : ''}" 
             onclick="${batchMode ? `toggleTransactionSelection('${t.id}', event)` : `showTransactionDetail('${t.id}')`}">
            ${batchMode ? `<input type="checkbox" class="transaction-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleTransactionSelection('${t.id}', event)">` : ''}
            <div class="transaction-icon" style="background: ${category ? category.color : '#9E9E9E'}">
                <i class="fas ${category ? category.icon : 'fa-question'}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-title">${t.counterparty || '未知商户'}</div>
                <div class="transaction-meta">
                    <span>${formatDate(t.date)}</span>
                    ${account ? `<span class="transaction-account">${account.name}</span>` : ''}
                    ${!t.categoryId ? '<span class="transaction-badge">待处理</span>' : ''}
                </div>
            </div>
            <div class="transaction-amount">
                <span class="amount ${t.type}">${formatAmount(t.amount, t.type)}</span>
                <span class="category ${t.categoryId ? '' : 'pending'}">${category ? category.name : '未分类'}</span>
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
        transactions = transactions.filter(t => t.accountId === accountFilter);
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
    const stats = AppState.getAccountStats(accountId);
    const account = AppState.getAccount(accountId);
    
    document.getElementById('account-summary').style.display = 'grid';
    document.getElementById('account-income').textContent = formatAmount(stats.income, 'income');
    document.getElementById('account-expense').textContent = formatAmount(stats.expense, 'expense');
    document.getElementById('account-balance').textContent = `¥${stats.balance.toFixed(2)}`;
}

// 【新增功能 3】隐藏账户汇总
function hideAccountSummary() {
    document.getElementById('account-summary').style.display = 'none';
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
}

// 更新当前月份显示
function updateCurrentMonth() {
    const year = AppState.currentMonth.getFullYear();
    const month = AppState.currentMonth.getMonth() + 1;
    document.getElementById('current-month').textContent = `${year}年${month}月`;
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
        transactions = transactions.filter(t => t.accountId === accountFilter);
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
    if (AppState.selectedTransactions.size === 0) return;
    
    showConfirm('确认删除？', `将删除选中的 ${AppState.selectedTransactions.size} 条交易记录`, () => {
        let transactions = AppState.getTransactions();
        transactions = transactions.filter(t => !AppState.selectedTransactions.has(t.id));
        AppState.saveTransactions(transactions);
        AppState.selectedTransactions.clear();
        AppState.batchMode = false;
        updateBatchUI();
        renderTransactions();
        renderHome();
        showToast('批量删除成功');
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
    const cleaned = str.replace(/[¥￥,\s]/g, '');
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
    const amount = parseAmountValue(amountValue);
    const type = parseTransactionType(typeValue, amount);
    const counterparty = String(counterpartyValue || '').trim();

    if (!date || !counterparty || amount === 0) {
        console.warn('交易数据无效:', { date, counterparty, amount });
        return null;
    }

    return {
        id: generateId(),
        date: date.toISOString(),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false,
        categoryRaw: data['交易分类'] || data['商品'] || ''
    };
};
    headers.forEach((header, index) => {
        data[header] = row[index];
    });
    
    let date, amount, type, counterparty;
    
    if (fileType === 'wechat') {
        date = parseWechatDate(data['交易时间']);
        amount = parseFloat(String(data['金额 (元)'] || data['金额'] || '').replace(/[¥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    } else if (fileType === 'alipay') {
        date = parseAlipayDate(data['交易时间']);
        amount = parseFloat(String(data['金额'] || '').replace(/[¥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    }
    
    if (!date || !counterparty) return null;
    
    return {
        id: generateId(),
        date: date.toISOString(),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false
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
        amount = parseFloat(String(data['金额 (元)'] || '').replace(/[¥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    } else if (fileType === 'alipay') {
        date = parseAlipayDate(data['交易时间']);
        amount = parseFloat(String(data['金额'] || '').replace(/[¥￥,\s]/g, '')) || 0;
        type = (String(data['收/支'] || '').includes('收入')) ? 'income' : 'expense';
        counterparty = String(data['交易对方'] || '').trim();
    }
    
    if (!date || !counterparty) return null;
    
    return {
        id: generateId(),
        date: date.toISOString(),
        amount,
        type,
        counterparty,
        accountId,
        isMatched: false
    };
}

function parseWechatDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    }
    const str = String(dateValue).trim();
    const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (match) {
        const isoStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:${match[6].padStart(2, '0')}`;
        return new Date(isoStr);
    }
    return new Date(str);
}

function parseAlipayDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    }
    const str = String(dateValue).trim();
    const match = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
    if (match) {
        const isoStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:00`;
        return new Date(isoStr);
    }
    return new Date(str);
}

function showPreviewModal() {
    document.getElementById('preview-success-count').textContent = previewData.transactions.length;
    document.getElementById('preview-error-count').textContent = previewData.errors.length;
    document.getElementById('preview-skip-count').textContent = previewData.skipped;
    
    const tbody = document.getElementById('preview-tbody');
    tbody.innerHTML = previewData.transactions.slice(0, 100).map(t => {
        const date = new Date(t.date);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const amountStr = t.type === 'income' ? `+${t.amount.toFixed(2)}` : `-${t.amount.toFixed(2)}`;
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${t.counterparty || '-'}</td>
                <td style="color: ${t.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'}">${amountStr}</td>
                <td>${t.type === 'income' ? '收入' : '支出'}</td>
                <td>-</td>
                <td>✓</td>
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
    
    // 保存交易
    const existingTransactions = AppState.getTransactions();
    AppState.saveTransactions([...previewData.transactions, ...existingTransactions]);
    
    // 【新增】更新账户余额
    updateAccountBalanceFromTransactions(previewData.transactions, previewData.accountId);
    
    closeModal('preview-modal');
    showToast(`成功导入 ${previewData.transactions.length} 条记录`);
    
    // 【新增】自动刷新首页汇总
    renderHome();
    
    // 刷新账户筛选器
    initAccountFilter();
}

// 【新增功能 2】更新账户余额
function updateAccountBalanceFromTransactions(transactions, accountId) {
    if (!accountId) return;
    
    const accounts = AppState.getAccounts();
    const accountIndex = accounts.findIndex(a => a.id === accountId);
    
    if (accountIndex === -1) return;
    
    let balanceChange = 0;
    transactions.forEach(t => {
        if (t.type === 'income') {
            balanceChange += t.amount;
        } else if (t.type === 'expense') {
            balanceChange -= t.amount;
        }
    });
    
    if (balanceChange !== 0) {
        accounts[accountIndex].balance = (accounts[accountIndex].balance || 0) + balanceChange;
        AppState.saveAccounts(accounts);
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
    
    container.innerHTML = pending.map(t => `
        <div class="pending-item" onclick="showProcessModal('${t.id}')">
            <div class="pending-content">
                <div class="pending-title">${t.counterparty || '未知商户'}</div>
                <div class="pending-meta">${formatDate(t.date)} · ${t.categoryRaw || '未分类'}</div>
            </div>
            <div class="pending-amount">
                <span class="amount ${t.type}">${formatAmount(t.amount, t.type)}</span>
            </div>
            <button class="btn-primary" onclick="event.stopPropagation(); showProcessModal('${t.id}')">处理</button>
        </div>
    `).join('');
}

// 初始化
function init() {
    initSampleData();
    initAccountFilter();
    renderHome();
    
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

// 初始化示例数据
function initSampleData() {
    if (AppState.getTransactions().length === 0) {
        const sampleData = [
            { id: generateId(), date: new Date().toISOString(), amount: 12580, type: 'income', counterparty: '工资收入', categoryId: '8', accountId: 'bank', isMatched: true },
            { id: generateId(), date: new Date(Date.now() - 86400000).toISOString(), amount: 35.5, type: 'expense', counterparty: '麦当劳', categoryId: '1', accountId: 'alipay', isMatched: true },
            { id: generateId(), date: new Date(Date.now() - 172800000).toISOString(), amount: 128, type: 'expense', counterparty: '滴滴出行', categoryId: '2', accountId: 'wechat', isMatched: true },
        ];
        AppState.saveTransactions(sampleData);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);

