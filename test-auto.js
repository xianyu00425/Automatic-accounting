// 自动化测试脚本 - 验证日期解析和字段完整性
// 运行: node test-auto.js

// ===== 模拟核心函数 =====

function generateId() {
    return 'test_' + Math.random().toString(36).substr(2, 9);
}

function parseWechatDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'number') {
        var excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    }
    var str = String(dateValue).trim();
    var match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (match) {
        return new Date(match[1] + '-' + String(match[2]).padStart(2,'0') + '-' + String(match[3]).padStart(2,'0') + 'T' + String(match[4]).padStart(2,'0') + ':' + String(match[5]).padStart(2,'0') + ':' + String(match[6]).padStart(2,'0'));
    }
    return new Date(str);
}

function formatDate(dateStr) {
    if (!dateStr) return '无效日期';
    var s = String(dateStr).trim();
    if (s.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

function rawDateValue(rawValue, fallbackDate) {
    if (rawValue === null || rawValue === undefined) return fallbackDate ? formatDate(fallbackDate) : '';
    var s = String(rawValue).trim();
    if (s.match(/^\d{4}[-\/]/)) return s;
    if (!isNaN(Number(s)) && Number(s) > 10000) return fallbackDate ? formatDate(fallbackDate) : s;
    return s;
}

function parseAmountValue(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Math.abs(value);
    const str = String(value).trim();
    if (!str || str === '' || str === '-') return 0;
    const cleaned = str.replace(/[￥￥,\s]/g, '');
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return 0;
    return Math.abs(amount);
}

function findAmountColumn(headers) {
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i] || '').trim();
        if (header.includes('金额') || header === 'Amount') return i;
    }
    return -1;
}

function parseTransactionType(value, amount) {
    if (!value) return amount >= 0 ? 'income' : 'expense';
    const str = String(value).trim();
    if (str.includes('收入') || str.includes('收款')) return 'income';
    if (str.includes('支出') || str.includes('付款')) return 'expense';
    return amount >= 0 ? 'income' : 'expense';
}

function parseExcelRow(row, headers, accountId, fileType) {
    const data = {};
    headers.forEach((header, index) => { data[header] = row[index]; });

    const amountIndex = findAmountColumn(headers);
    const typeIndex = headers.findIndex(h => String(h || '').includes('收/支') || String(h || '').includes('收支'));
    const timeIndex = headers.findIndex(h => String(h || '').includes('时间') || String(h || '').includes('日期'));
    const counterpartyIndex = headers.findIndex(h => String(h || '').includes('对方') || String(h || '').includes('商户'));

    if (timeIndex === -1 || amountIndex === -1 || counterpartyIndex === -1) return null;

    const timeValue = row[timeIndex];
    const amountValue = row[amountIndex];
    const typeValue = typeIndex !== -1 ? row[typeIndex] : null;
    const counterpartyValue = row[counterpartyIndex];

    let date = fileType === 'wechat' ? parseWechatDate(timeValue) : null; // 简化
    const amount = parseAmountValue(amountValue);
    const type = parseTransactionType(typeValue, amount);
    const counterparty = String(counterpartyValue || '').trim();

    if (!date || !counterparty || amount === 0) return null;

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

// ===== 测试用例 =====

var passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) {
        console.log('  ✅ PASS:', msg);
        passed++;
    } else {
        console.log('  ❌ FAIL:', msg);
        failed++;
    }
}

console.log('\n===== 自动测试开始 =====\n');

// 测试1: parseWechatDate 解析 Excel 数字
console.log('[测试1] parseWechatDate - Excel数字日期解析');
var excelNum = 46111.6448842593;
var parsedDate = parseWechatDate(excelNum);
assert(parsedDate !== null, 'Excel数字应成功解析为Date对象');
assert(!isNaN(parsedDate.getTime()), 'Date应为有效值');
var y = parsedDate.getFullYear(), m = parsedDate.getMonth()+1, d = parsedDate.getDate();
assert(y === 2026 && m === 3 && d === 30, '46111.64... 应为 2026/3/30, 实际=' + y+'/'+m+'/'+d);

// 测试2: rawDateValue 处理 Excel 数字
console.log('\n[测试2] rawDateValue - Excel数字→可读格式');
var rd = rawDateValue(excelNum, parsedDate);
assert(rd !== String(excelNum), '不应返回原始数字字符串');
assert(rd.includes('2026'), '应包含年份2026, 实际=' + rd);
assert(rd.includes('/'), '应使用斜杠分隔符');
console.log('  📅 输出结果:', rd);

// 测试3: rawDateValue 处理文本日期
console.log('\n[测试3] rawDateValue - 文本日期原样保留');
var textDate = '2026-03-29 18:32:00';
var rdText = rawDateValue(textDate);
assert(rdText === textDate, '文本日期应原样返回');

// 测试4: parseExcelRow 完整流程
console.log('\n[测试4] parseExcelRow - 完整Excel行解析');
var testHeaders = ['交易时间', '交易类型', '交易对方', '金额(元)', '收/支', '支付方式', '当前状态', '交易分类', '商品'];
var testRow = [46111.6448842593, '滴滴快车打车:尹师傅-03月29日行程', '滴滴出行', 33.3, '支出', '零钱', '支付成功', '', ''];
var tx = parseExcelRow(testRow, testHeaders, 'wechat', 'wechat');
assert(tx !== null, '应成功解析交易记录');
assert(tx.dateRaw !== undefined, '应有dateRaw字段');
assert(tx.dateRaw !== String(46111.6448842593), 'dateRaw不应是Excel数字');
assert(tx.rawData !== undefined, '应有rawData字段');
assert(tx.rawData.tradeTime !== undefined, 'rawData应有tradeTime');
assert(tx.rawData.tradeType !== undefined, 'rawData应有tradeType');
assert(tx.counterparty === '滴滴出行', '交易对方=滴滴出行, 实际=' + tx.counterparty);
assert(Math.abs(tx.amount - 33.3) < 0.01, '金额≈33.3, 实际=' + tx.amount);
assert(tx.type === 'expense', '类型=expense');
assert(tx.rawData.incomeExpense === '支出', '费用类型=支出');
assert(tx.rawData.tradeType === '滴滴快车打车:尹师傅-03月29日行程', '交易类型应保留原文');
console.log('  📋 dateRaw:', tx.dateRaw);
console.log('  📋 tradeTime:', tx.rawData.tradeTime);
console.log('  📋 tradeType:', tx.rawData.tradeType);
console.log('  📋 incomeExpense:', tx.rawData.incomeExpense);

// 测试5: 第二笔数据
console.log('\n[测试5] parseExcelRow - 第二笔转账数据');
var testRow2 = [46110.7222222222, '转账备注:微信转账', 'F-邱简', 45, '支出', '微信支付', '已收款', '', ''];
var tx2 = parseExcelRow(testRow2, testHeaders, 'wechat', 'wechat');
assert(tx2 !== null, '第二笔应成功解析');
assert(tx2.dateRaw !== String(46110.7222222222), 'dateRaw不应是Excel数字');
assert(tx2.counterparty === 'F-邱简', '交易对方=F-邱简');
assert(tx2.rawData.tradeType === '转账备注:微信转账', '交易类型=转账备注:微信转账');
assert(tx2.rawData.payMethod === '微信支付', '支付方式=微信支付');
console.log('  📋 dateRaw:', tx2.dateRaw);
console.log('  📋 tradeType:', tx2.rawData.tradeType);

// 测试6: 预览表格渲染模拟
console.log('\n[测试6] 预览表格渲染模拟');
var t = tx;
var dateStr = t.dateRaw || formatDate(t.date);
var amountStr = t.type === 'income' ? '+' + t.amount.toFixed(2) : '-' + t.amount.toFixed(2);
var rd = t.rawData || {};
assert(dateStr !== String(46111.6448842593), '预览时间列不应显示Excel数字');
assert(rd.incomeExpense !== undefined, '预览应有费用类型列');
assert(rd.tradeType !== undefined, '预览应有分类列');
console.log('  📊 预览行:');
console.log('     时间:', dateStr);
console.log('     对方:', t.counterparty);
console.log('     金额:', amountStr);
console.log('     类型:', rd.incomeExpense);
console.log('     分类:', rd.tradeType);

// ===== 结果汇总 =====
console.log('\n===== 测试结果 =====');
console.log('通过: ' + passed + ', 失败: ' + failed + ', 总计: ' + (passed + failed));
if (failed > 0) {
    console.log('\n⚠️ 有失败项，需要修复！');
    process.exit(1);
} else {
    console.log('\n✅ 全部通过！可以正常使用。\n');
}
