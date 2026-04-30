---
name: seerfar
description: SeerFar 热销榜单选品页面使用指南。用于在 `https://seerfar.cn/admin/product-search.html` 页面上理解平台切换、选品模式、预设筛选按钮和多维筛选条件，并指导用户完成选品查询。
---

# SeerFar 热销榜单选品页面使用指南

## 页面概述
- **页面URL**: `https://seerfar.cn/admin/product-search.html`
- **页面标题**: 热销榜单选品
- **功能**: 通过多维度筛选条件，在Ozon和Wildberries平台上进行智能选品

---

## 页面结构

### 1. 平台选择区
**元素**: Radio按钮
- `Ozon` - 默认选中，俄罗斯最大电商平台
- `Wildberries` - 俄罗斯另一大电商平台

**使用方式**: 点击切换平台

### 2. 选品模式切换
**元素**: 文本标签
- `精简` - 简化筛选条件
- `进阶` - 完整筛选条件（默认）

**使用方式**: 点击切换模式

### 3. 推荐选品模式
**元素**: 一组按钮
- `销量飙升榜` - 快速增长的爆款商品
- `潜力市场` - 有潜力的细分市场
- `未被满足的市场` - 需求未饱和的市场
- `不压库存的市场` - 低库存压力市场
- `飙升关键词` - 热门搜索关键词
- `低评论依赖度产品` - 不依赖评论的产品
- `自定义` - 自定义筛选条件

**使用方式**: 点击按钮快速应用预设筛选条件

### 4. 筛选条件（进阶模式）

#### 4.1 类目筛选
**元素**:
- `类目及子类目` (readonly) - 只读显示
- `类目及子类目` (可输入) - 可搜索选择

**操作方式**:
1. 点击输入框打开类目菜单
2. 选择一级类目（如：家具、电子产品等）
3. 选择二级子类目（如：电脑和办公椅）

**主要类目**:
- 服装、鞋类、电子产品、建筑和装修、家用电器、宠物用品、儿童用品
- 美容和卫生、运动与休闲、文具、小百货和配饰、住宅和花园、汽车用品
- 食品、家具（含：电脑和办公椅、沙发、桌类等）、书籍、日化、珠宝等

#### 4.2 评论数筛选
**元素**: spinbutton输入框
- `最小值` - 最小评论数
- `最大值` - 最大评论数

#### 4.3 评分筛选
**元素**: spinbutton输入框
- `最小值` - 最低评分（1-5分）
- `最大值` - 最高评分

#### 4.4 Q&A筛选
**元素**: spinbutton输入框
- `最小值` / `最大值` - 问答数量范围

#### 4.5 上架时间
**元素**: combobox下拉菜单
**选项**:
- `近30天`
- `近90天`
- `近180天`
- `近1年`
- `近2年`
- `所有`

#### 4.6 产品标识
**元素**: checkbox复选框
- `新品` - 新上市商品
- `正品` - 品牌正品
- `畅销品` - 热销商品

#### 4.7 重量筛选
**元素**: spinbutton输入框
- 单位：g（克）
- `最小值` / `最大值`

#### 4.8 体积筛选
**元素**: spinbutton输入框
- 单位：L（升）
- `最小值` / `最大值`

#### 4.9 售价筛选 ⭐
**元素**: spinbutton输入框
- 单位：₽（卢布）
- `最小值` - 最低售价（如：5000）
- `最大值` - 最高售价

**用途**: 筛选高溢价商品

#### 4.10 毛利率筛选 ⭐
**元素**: spinbutton输入框
- 单位：%
- `最小值` - 最低毛利率（如：30）
- `最大值` - 最高毛利率

**用途**: 筛选高附加值商品

#### 4.11 销量筛选
**元素**: spinbutton输入框
- `最小值` / `最大值` - 月销量范围

#### 4.12 销售额筛选
**元素**: spinbutton输入框
- 单位：₽
- `最小值` / `最大值` - 月销售额范围

#### 4.13 销量增长率筛选 ⭐
**元素**: spinbutton输入框
- 单位：%
- `最小值` / `最大值` - 增长率范围

**用途**: 筛选快速增长商品

#### 4.14 变体数筛选
**元素**: spinbutton输入框
- `最小值` / `最大值` - SKU变体数量

#### 4.15 加购率筛选
**元素**: spinbutton输入框
- 单位：%
- `最小值` / `最大值`

#### 4.16 退货取消率筛选
**元素**: spinbutton输入框
- 单位：%
- `最小值` / `最大值`

#### 4.17 卖家类型
**元素**: combobox下拉菜单
**选项**:
- `全部`
- `跨境卖家` - 跨境电商卖家
- `本土卖家` - 俄罗斯本地卖家

#### 4.18 配送方式
**元素**: combobox搜索框
- 可搜索：FBO（平台仓）、FBS（卖家仓）

#### 4.19 店铺筛选
**元素**: combobox搜索框
- 可搜索特定店铺

#### 4.20 品牌筛选
**元素**: combobox下拉菜单 + textbox
**选项**:
- `包含` - 包含该品牌
- `排除` - 排除该品牌
- `无品牌` - 无品牌商品

#### 4.21 SKU筛选
**元素**: textbox输入框
- 可输入特定SKU编号

#### 4.22 热词筛选
**元素**: textbox输入框
- 输入热门搜索关键词

#### 4.23 标签词筛选
**元素**: textbox输入框
- 输入商品标签关键词

#### 4.24 日期范围
**元素**: combobox下拉菜单
**选项**: 2025-03 至 2026-02，以及"近30天"

### 5. 操作按钮区

#### 5.1 保存当前模式
**元素**: button按钮
- 保存当前筛选条件配置

#### 5.2 重置
**元素**: button按钮
- 清空所有筛选条件

#### 5.3 查询 ⭐
**元素**: button按钮
- 执行筛选，显示结果

### 6. 结果展示区

#### 6.1 查询结果数
- 显示符合条件的商品总数

#### 6.2 批量操作按钮
- `批量采集` - 批量采集商品信息
- `加入产品库` - 添加到产品库
- `加入自定义类目` - 添加到自定义分类
- `删除所选` - 删除选中的商品
- `导出` - 导出数据

#### 6.3 变体合并开关
- 开启后合并同款不同SKU的商品

### 7. 结果表格字段

| 字段 | 说明 |
|------|------|
| 序号 | 商品序号 |
| 复选框 | 选择商品 |
| 商品名称 | 商品标题（可点击查看详情） |
| 类目 | 商品所属类目（中文/俄文） |
| 售价 | 当前售价（₽） |
| 销量+增长率 | 月销量和增长率（如：207+332%） |
| 销售额+增长率 | 月销售额和增长率（₽+%） |
| 操作 | 详情、采集等操作 |

---

## Chrome DevTools 操作示例

### 示例1：基本选品流程
```javascript
// 1. 选择类目
const categoryInput = document.querySelector('input[placeholder="类目及子类目"]');
categoryInput.click();
// 等待菜单展开后
// 点击"家具"
// 点击"电脑和办公椅"

// 2. 设置筛选条件
// 设置售价最小值
const priceMinInput = document.querySelector('input[placeholder="最小值"]');
priceMinInput.value = '5000';

// 设置毛利率最小值
const marginMinInput = document.querySelectorAll('input[placeholder="最小值"]')[1];
marginMinInput.value = '30';

// 3. 点击查询
const queryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === '查询');
queryBtn.click();

// 4. 获取结果
setTimeout(() => {
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const name = row.querySelector('a')?.textContent;
    const price = row.querySelectorAll('td')[4]?.textContent;
    const sales = row.querySelectorAll('td')[5]?.textContent;
    console.log({ name, price, sales });
  });
}, 3000);
```

### 示例2：切换选品模式
```javascript
// 点击"潜力市场"按钮
const buttons = document.querySelectorAll('button');
Array.from(buttons).forEach(btn => {
  if (btn.textContent === '潜力市场') {
    btn.click();
  }
});
```

### 示例3：筛选高附加值商品
```javascript
// 高溢价（售价>10000₽）+ 高毛利（>30%）+ 高增长（>100%）
const filters = {
  priceMin: 10000,
  marginMin: 30,
  growthMin: 100
};

// 设置各字段值...
// 然后点击查询
```

### 示例4：提取结果数据
```javascript
function extractProducts() {
  const products = [];
  const rows = document.querySelectorAll('tbody tr');

  rows.forEach((row, index) => {
    const link = row.querySelector('a');
    const cells = row.querySelectorAll('td');
    const text = row.textContent;

    products.push({
      index: index + 1,
      name: link?.textContent?.trim(),
      sku: text.match(/(\d{8,})/)?.[1] || '',
      category: cells[3]?.textContent?.trim(),
      price: cells[4]?.textContent?.trim(),
      salesGrowth: cells[5]?.textContent?.trim(),
      revenueGrowth: cells[6]?.textContent?.trim()
    });
  });

  return products;
}
```

---

## 常用选品策略

### 策略1：高溢价高附加值
- **售价最小值**: 10000₽
- **毛利率最小值**: 30%
- **选品模式**: 潜力市场
- **适用类目**: 家具/电脑和办公椅、电子产品

### 策略2：爆款追踪
- **选品模式**: 销量飙升榜
- **销量增长率最小值**: 100%
- **销量最小值**: 100

### 策略3：蓝海市场
- **选品模式**: 未被满足的市场
- **评论数最大值**: 50（竞争较少）
- **评分最小值**: 4.0

### 策略4：低风险高回报
- **选品模式**: 低评论依赖度产品
- **退货取消率最大值**: 10%
- **评分最小值**: 4.5

---

## 注意事项

1. **类目选择**: 必须先选择类目才能进行精准筛选
2. **价格区间**: 建议设置合理的价格区间避免过多结果
3. **数据更新**: 数据每日更新，建议定期查看
4. **平台差异**: Ozon和Wildberries的类目结构略有不同
5. **结果限制**: 查询结果可能较多，建议使用多个筛选条件组合

---

## 快捷操作UID参考

| 功能 | UID |
|------|-----|
| 类目输入框 | `19_58` |
| 查询按钮 | `19_208` |
| 重置按钮 | `19_207` |
| 平台Ozon | `19_40` |
| 平台WB | `19_42` |
| 毛利率最小值 | `19_115` |
| 售价最小值 | `19_108` |

---

## Agent操作经验教训 ⚠️

### 重要发现：类目选择不可靠，优先使用热词搜索

**问题1：类目菜单JavaScript操作不稳定**
- 通过`document.querySelector`查找类目菜单项后使用`.click()`点击不生效
- 级联菜单展开后子菜单项难以通过JavaScript定位和点击
- `el-cascader`组件的DOM结构复杂，选择器容易失效

**解决方案：优先使用"热词"筛选**
```javascript
// ✅ 推荐方式：使用热词搜索
const allInputs = document.querySelectorAll('input[type="text"]');
const hotWordInput = allInputs[5]; // 热词输入框
hotWordInput.value = 'мышь'; // 使用俄语关键词
hotWordInput.dispatchEvent(new Event('input', { bubbles: true }));

// ❌ 不推荐：尝试通过点击菜单选择类目
const categoryInput = document.querySelector('input[placeholder="类目及子类目"]');
categoryInput.click(); // 菜单展开但子项点击无效
```

### 常用产品类目俄语对照表

| 中文 | 俄语 | 备注 |
|------|------|------|
| 鼠标 | мышь | ✅ 有效 |
| 电脑鼠标 | Мышь | 类目名称 |
| 游戏鼠标 | Игровая мышь | 类目名称 |
| 键盘 | клавиатура | |
| 耳机 | наушники | |
| 充电器 | зарядное устройство | |
| 数据线 | кабель | |

**重要**：搜索时优先使用俄语单词，而不是中文类目名称。

### 产品去重处理

**问题2：变体合并导致重复产品**
- 当"变体合并"开启时，同款不同颜色的产品会重复出现在结果中
- 需要通过产品名称进行去重

```javascript
const seenNames = new Set();
products.forEach(p => {
  if (seenNames.has(p.name)) return;
  seenNames.add(p.name);
  // 处理产品...
});
```

### 综合评分公式

**高溢价高销售产品评分：**
```javascript
const score = price * 0.3 + sales * 3 + margin * 10 + growth * 3;
```

- `price`: 售价权重 0.3（高溢价）
- `sales`: 销量权重 3（高销售）
- `margin`: 毛利率权重 10（高利润）
- `growth`: 增长率权重 3（快速增长）

### 快速定位输入框

```javascript
// 获取所有文本输入框
const allInputs = document.querySelectorAll('input[type="text"]');

// 索引对应关系：
// [0] - SKU 搜索
// [1] - 类目及子类目 (readonly)
// [2] - 类目及子类目 (可编辑)
// [3] - 品牌
// [4] - SKU
// [5] - 热词 ⭐
// [6] - 标签词
```

### 推荐的Agent操作流程

```javascript
async function searchProducts(keyword, minPrice, minSales) {
  // 1. 设置热词（使用俄语）
  const hotWordInput = document.querySelectorAll('input[type="text"]')[5];
  hotWordInput.value = keyword;
  hotWordInput.dispatchEvent(new Event('input', { bubbles: true }));

  // 2. 设置最低售价
  const minPriceInput = document.querySelector('input[placeholder="最小值"]');
  minPriceInput.value = minPrice;
  minPriceInput.dispatchEvent(new Event('input', { bubbles: true }));

  // 3. 点击查询
  const queryBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('查询'));
  queryBtn.click();

  // 4. 等待结果
  await new Promise(r => setTimeout(r, 3000));

  // 5. 提取并去重
  const products = extractUniqueProducts();
  return products.filter(p => p.price >= minPrice && p.sales >= minSales);
}
```

---

## 相关页面
- 首页: `https://seerfar.cn/admin/index.html`
- 登录页: `https://seerfar.cn/admin/sign-in.html`
- 知识库: `https://www.seerfar.cn/support/`
