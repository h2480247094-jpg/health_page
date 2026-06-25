// ===== Micronutrient Tracking Module =====
// All micronutrient definitions, RDA values, daily aggregation, coverage
// calculation, deficiency warnings, and supplement-to-micro mappings.

const MICRONUTRIENT_RDA = {
  vitaminA:  { name: '维生素A',   unit: 'ug RAE', rda: 800,  category: 'vitamin', fn: '保护视力、维持皮肤黏膜健康、增强免疫力、支持骨骼生长' },
  vitaminD:  { name: '维生素D',   unit: 'ug',     rda: 10,   category: 'vitamin', fn: '促进钙吸收、维持骨骼健康、调节免疫、改善情绪' },
  vitaminE:  { name: '维生素E',   unit: 'mg a-TE', rda: 14,  category: 'vitamin', fn: '抗氧化、保护细胞膜、延缓衰老、维持皮肤健康' },
  vitaminK:  { name: '维生素K',   unit: 'ug',     rda: 80,   category: 'vitamin', fn: '促进血液凝固、参与骨骼代谢、预防血管钙化' },
  vitaminB1: { name: '维生素B1',  unit: 'mg',     rda: 1.4,  category: 'vitamin', fn: '能量代谢的关键辅酶、维持神经系统正常功能、抗疲劳' },
  vitaminB2: { name: '维生素B2',  unit: 'mg',     rda: 1.4,  category: 'vitamin', fn: '参与能量代谢、维护皮肤和黏膜健康、缓解眼疲劳' },
  vitaminB3: { name: '烟酸(B3)',  unit: 'mg NE',  rda: 15,   category: 'vitamin', fn: '参与能量代谢、维护神经系统、改善血液循环、降低胆固醇' },
  vitaminB6: { name: '维生素B6',  unit: 'mg',     rda: 1.4,  category: 'vitamin', fn: '蛋白质代谢必需、合成神经递质、调节情绪和睡眠' },
  folate:    { name: '叶酸(B9)',  unit: 'ug DFE', rda: 400,  category: 'vitamin', fn: '细胞分裂和DNA合成必需、预防贫血、维护心脑血管' },
  vitaminB12:{ name: '维生素B12', unit: 'ug',     rda: 2.4,  category: 'vitamin', fn: '维持神经系统健康、促进红细胞生成、预防贫血' },
  vitaminC:  { name: '维生素C',   unit: 'mg',     rda: 100,  category: 'vitamin', fn: '抗氧化、促进胶原蛋白合成、增强免疫力、促进铁吸收' },
  calcium:   { name: '钙',        unit: 'mg',     rda: 800,  category: 'mineral', fn: '构成骨骼和牙齿、维持神经肌肉兴奋性、参与凝血过程' },
  iron:      { name: '铁',        unit: 'mg',     rda: 12,   category: 'mineral', fn: '血红蛋白的核心成分、运输氧气、预防贫血、维持免疫力' },
  magnesium: { name: '镁',        unit: 'mg',     rda: 330,  category: 'mineral', fn: '放松肌肉和神经、改善睡眠质量、参与300+种酶反应、缓解压力' },
  zinc:      { name: '锌',        unit: 'mg',     rda: 12,   category: 'mineral', fn: '促进伤口愈合、维持免疫力、参与蛋白质合成、保护皮肤' },
  selenium:  { name: '硒',        unit: 'ug',     rda: 60,   category: 'mineral', fn: '强抗氧化剂、保护甲状腺功能、增强免疫力、延缓衰老' },
  potassium: { name: '钾',        unit: 'mg',     rda: 2000, category: 'mineral', fn: '维持细胞内渗透压、调节血压、支持神经肌肉功能' },
  iodine:    { name: '碘',        unit: 'ug',     rda: 120,  category: 'mineral', fn: '合成甲状腺激素、调节新陈代谢、促进大脑发育' },
  lutein:    { name: '叶黄素',    unit: 'mg',     rda: 10,   category: 'special', fn: '保护视网膜、过滤蓝光损伤、预防黄斑变性、缓解视疲劳' },
  omega3:    { name: 'Omega-3',   unit: 'mg',     rda: 500,  category: 'special', fn: '抗炎、保护心脑血管、维持大脑功能、改善皮肤屏障、缓解眼干' }
};

const MICRO_KEYS = Object.keys(MICRONUTRIENT_RDA);

function getMicroRDA(key) {
  return MICRONUTRIENT_RDA[key] ? MICRONUTRIENT_RDA[key].rda : 0;
}

// ===== Supplement → Micronutrient Mapping =====
const SUPPLEMENT_MICRO_BASE = {
  '鱼油':      { omega3: 300 },
  '维生素D':   { vitaminD: 10 },
  '维生素D3':  { vitaminD: 10 },
  '维生素C':   { vitaminC: 500 },
  '维生素B族': { vitaminB1: 1.4, vitaminB2: 1.6, vitaminB3: 18, vitaminB6: 2, vitaminB12: 2.5, folate: 200 },
  '维生素B12': { vitaminB12: 2.5 },
  '维生素E':   { vitaminE: 100 },
  '维生素A':   { vitaminA: 500 },
  '镁':        { magnesium: 200 },
  '甘氨酸镁':  { magnesium: 200 },
  '柠檬酸镁':  { magnesium: 150 },
  '锌':        { zinc: 15 },
  '钙':        { calcium: 300 },
  '钙片':      { calcium: 300 },
  '铁':        { iron: 15 },
  '硒':        { selenium: 55 },
  '钾':        { potassium: 100 },
  '碘':        { iodine: 100 },
  '叶黄素':    { lutein: 10 },
  '蛋白粉':    { calcium: 120, iron: 0.5, magnesium: 20, zinc: 1.5, potassium: 160, vitaminB2: 0.3, vitaminB6: 0.1, vitaminB12: 0.6 },
  '肌酸':      {},
  '复合维生素':{ vitaminA: 500, vitaminD: 5, vitaminE: 15, vitaminK: 40,
                 vitaminB1: 1.4, vitaminB2: 1.6, vitaminB3: 18, vitaminB6: 2,
                 folate: 200, vitaminB12: 2.5, vitaminC: 80,
                 calcium: 100, iron: 5, magnesium: 50, zinc: 5, selenium: 30 },
};

function getSupplementMicros(name, dosage) {
  if (!name) return null;
  const trimmed = name.trim();
  if (SUPPLEMENT_MICRO_BASE[trimmed]) {
    return _buildMicroResult(SUPPLEMENT_MICRO_BASE[trimmed], dosage);
  }
  for (const [key, val] of Object.entries(SUPPLEMENT_MICRO_BASE)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return _buildMicroResult(val, dosage);
    }
  }
  return null;
}

function _buildMicroResult(base, dosage) {
  const result = {};
  for (const [key, val] of Object.entries(base)) {
    result[key] = +(val * dosage).toFixed(2);
  }
  return result;
}

// ===== Deficiency Suggestion Map =====
const MICRO_SUGGESTIONS = {
  vitaminA:  '多吃胡萝卜、南瓜、菠菜、动物肝脏',
  vitaminD:  '每天晒太阳15-30分钟，多吃三文鱼、蛋黄，或补充维生素D3',
  vitaminE:  '多吃坚果（杏仁、葵花籽）、植物油',
  vitaminK:  '多吃绿叶蔬菜（菠菜、羽衣甘蓝）、西兰花',
  vitaminB1: '多吃全谷物、瘦肉、豆类',
  vitaminB2: '多吃奶制品、鸡蛋、瘦肉',
  vitaminB3: '多吃禽肉、鱼类、花生',
  vitaminB6: '多吃鸡肉、鱼肉、土豆、香蕉',
  folate:    '多吃深绿色叶菜、豆类、动物肝脏',
  vitaminB12:'多吃动物肝脏、鱼类、奶制品、鸡蛋',
  vitaminC:  '多吃柑橘类水果、猕猴桃、青椒、西兰花',
  calcium:   '多喝牛奶、吃豆制品（豆腐）、小虾皮、芝麻酱',
  iron:      '多吃红肉、动物肝脏、黑木耳、红枣（搭配维生素C促进吸收）',
  magnesium: '多吃坚果、深绿色蔬菜、全谷物、黑巧克力',
  zinc:      '多吃牡蛎、红肉、南瓜籽、坚果',
  selenium:  '多吃巴西坚果、海鱼、鸡蛋、蘑菇',
  potassium: '多吃香蕉、土豆、豆类、牛油果',
  iodine:    '使用加碘盐、多吃海带、紫菜、海鱼',
  lutein:    '多吃菠菜、羽衣甘蓝、玉米、蛋黄，或补充叶黄素补充剂',
  omega3:    '多吃深海鱼（三文鱼、鲭鱼）、亚麻籽、核桃，或补充鱼油'
};

// ===== Aggregation Functions =====

/**
 * Aggregate micronutrients for a single date from diet entries and
 * supplements across all records for that date.
 * Returns { vitaminA: 320, vitaminD: 2.1, ... }
 */
function getDayMicroTotals(records, date) {
  const totals = {};
  MICRO_KEYS.forEach(k => { totals[k] = 0; });

  const dayRecords = records.filter(r => r.date === date);
  for (const r of dayRecords) {
    // Diet contributions
    for (const diet of (r.diet || [])) {
      if (diet.micros) {
        for (const [k, v] of Object.entries(diet.micros)) {
          if (totals.hasOwnProperty(k)) totals[k] += v || 0;
        }
      }
    }
    // Supplement contributions
    for (const supp of (r.supplements || [])) {
      const suppMicros = getSupplementMicros(supp.name, supp.dosage || 1);
      if (suppMicros) {
        for (const [k, v] of Object.entries(suppMicros)) {
          if (totals.hasOwnProperty(k)) totals[k] += v || 0;
        }
      }
    }
  }

  // Round to 2 decimal places
  for (const k of MICRO_KEYS) {
    totals[k] = +totals[k].toFixed(2);
  }
  return totals;
}

/**
 * Returns coverage ratios (intake / RDA) for a single date.
 * Ratio of 1.0 = 100% RDA met.
 */
function getMicroCoverage(records, date) {
  const totals = getDayMicroTotals(records, date);
  const coverage = {};
  for (const k of MICRO_KEYS) {
    const rda = MICRONUTRIENT_RDA[k].rda;
    coverage[k] = rda > 0 ? +Math.min(totals[k] / rda, 2.0).toFixed(4) : 0;
  }
  return coverage;
}

/**
 * Returns per-day coverage arrays for the last N days.
 * Returns { dates: [...], series: { vitaminA: [0.4, 0.5, ...], ... } }
 */
function getMicroCoverageForRange(records, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recent = records.filter(r => r.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));

  const dateList = [];
  const d = new Date(cutoff);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (d <= today) {
    dateList.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }

  const series = {};
  MICRO_KEYS.forEach(k => { series[k] = []; });

  for (const date of dateList) {
    const cov = getMicroCoverage(records, date);
    for (const k of MICRO_KEYS) {
      series[k].push(cov[k] != null ? +cov[k].toFixed(4) : null);
    }
  }

  return { dates: dateList, series };
}

// ===== Top Foods Scoring (for "best overall" recommendations) =====
// Each food covers multiple micros; value is relative richness (1-3)
const TOP_FOODS = {
  '菠菜':       { vitaminA:2, vitaminK:3, folate:3, iron:2, magnesium:2, calcium:1, lutein:3, vitaminC:1, vitaminB2:1, vitaminE:1 },
  '三文鱼':     { vitaminD:3, omega3:3, vitaminB12:3, vitaminB3:2, vitaminB6:2, selenium:2, iodine:1, vitaminE:1 },
  '鸡蛋':       { vitaminA:1, vitaminD:1, vitaminB2:1, vitaminB12:1, folate:1, selenium:2, lutein:1, iron:1, zinc:1, omega3:1 },
  '牛奶':       { calcium:3, vitaminB2:2, vitaminB12:2, iodine:2, potassium:1, magnesium:1, zinc:1 },
  '牛肝/猪肝':  { vitaminA:3, iron:3, folate:3, vitaminB12:3, vitaminB2:3, vitaminB3:2, zinc:2, selenium:2, vitaminB6:1 },
  '西兰花':     { vitaminC:3, vitaminK:2, folate:2, calcium:1, iron:1, magnesium:1, lutein:1, vitaminA:1 },
  '杏仁':       { vitaminE:3, magnesium:2, calcium:1, iron:1, zinc:1, vitaminB2:1, omega3:1 },
  '牛肉':       { iron:2, zinc:3, vitaminB12:2, vitaminB3:2, vitaminB6:1, selenium:2 },
  '胡萝卜':     { vitaminA:3, lutein:1, vitaminK:1 },
  '猕猴桃':     { vitaminC:3, vitaminE:1, folate:1, potassium:1, lutein:1 },
  '香蕉':       { potassium:3, vitaminB6:2, magnesium:1 },
  '核桃':       { omega3:3, vitaminE:1, magnesium:1, zinc:1 },
  '豆腐':       { calcium:2, iron:1, magnesium:1, zinc:1, omega3:1 },
  '牡蛎':       { zinc:3, iron:2, vitaminB12:2, selenium:2, iodine:1 },
  '海带/紫菜':  { iodine:3, calcium:1, iron:1, magnesium:1, omega3:1 },
  '南瓜籽':     { magnesium:2, zinc:2, iron:1, omega3:1, vitaminE:1 },
  '牛油果':     { potassium:2, vitaminE:2, vitaminK:1, magnesium:1, folate:1, lutein:1 },
  '青椒':       { vitaminC:3, vitaminA:1, vitaminB6:1, lutein:1 },
  // Vegetables
  '番茄':       { vitaminC:2, vitaminA:1, vitaminK:1, potassium:1, lutein:1 },
  '红薯':       { vitaminA:3, vitaminC:2, potassium:2, vitaminB6:1, magnesium:1 },
  '紫甘蓝':     { vitaminC:2, vitaminK:3, vitaminA:1, folate:1, calcium:1, lutein:1 },
  '芹菜':       { vitaminK:2, vitaminA:1, potassium:1, lutein:1, folate:1 },
  '黄瓜':       { vitaminK:1, vitaminC:1, potassium:1, lutein:1 },
  '蘑菇':       { selenium:2, vitaminB2:1, vitaminB3:1, potassium:1, zinc:1 },
  '金针菇':     { vitaminB3:1, vitaminB2:1, selenium:1, potassium:1, zinc:1 },
'香菇':       { vitaminD:2, selenium:1, vitaminB2:1, vitaminB3:1, potassium:1, zinc:1 },
  '木耳':       { iron:1, calcium:2, vitaminK:1, magnesium:1, selenium:1 },
  '海带':       { iodine:3, calcium:1, iron:1, magnesium:1, omega3:1 },
  '紫菜':       { iodine:3, vitaminB12:1, iron:1, calcium:1, omega3:2 },
  '裙带菜':     { iodine:3, calcium:2, magnesium:1, iron:1, omega3:2 },
  '山药':       { potassium:2, vitaminB6:1, vitaminC:1, magnesium:1, zinc:1 },
  '莲藕':       { vitaminC:1, potassium:1, iron:1, vitaminB6:1 },
  '竹笋':       { potassium:1, vitaminB6:1, folate:1, magnesium:1 },
  '秋葵':       { vitaminK:2, vitaminC:1, folate:2, magnesium:1, calcium:1, lutein:1 },
  // Fruits
  '橙子':       { vitaminC:3, folate:1, potassium:1 },
  '苹果':       { vitaminC:1, potassium:1 },
  '蓝莓':       { vitaminC:1, vitaminK:2, vitaminE:1 },
  '草莓':       { vitaminC:3, folate:1, potassium:1, lutein:1 },
  '芒果':       { vitaminA:2, vitaminC:2, vitaminE:1, lutein:1 },
  '木瓜':       { vitaminA:2, vitaminC:3, folate:1, lutein:2 },
  '樱桃':       { vitaminC:1, potassium:2, iron:1 },
  '石榴':       { vitaminC:1, vitaminK:2, potassium:2, folate:1 },
  '红枣':       { iron:1, vitaminC:1, potassium:2, magnesium:1, folate:1 },
  '枸杞':       { vitaminA:3, lutein:3, vitaminC:1, iron:1, zinc:1, selenium:1 },
  '柠檬':       { vitaminC:3, potassium:1 },
  // Grains & Staples
  '燕麦':       { magnesium:2, zinc:1, iron:1, vitaminB1:2, potassium:1, selenium:1 },
  '荞麦':       { magnesium:2, vitaminB1:1, vitaminB2:1, zinc:1, potassium:1, iron:1 },
  '糙米':       { magnesium:2, vitaminB1:1, vitaminB3:1, zinc:1, selenium:1 },
  '小米':       { magnesium:2, vitaminB1:2, iron:1, zinc:1, selenium:1 },
  '玉米':       { lutein:2, vitaminB1:1, vitaminB3:1, magnesium:1, potassium:1, folate:1 },
  '全麦面包':   { vitaminB1:1, magnesium:1, iron:1, zinc:1, selenium:1 },
  '藜麦':       { magnesium:3, iron:2, zinc:1, folate:1, potassium:1, vitaminB2:1 },
  // Legumes
  '黄豆':       { calcium:2, iron:2, magnesium:2, folate:2, potassium:2, zinc:1, omega3:1 },
  '黑豆':       { iron:2, calcium:2, magnesium:2, folate:2, potassium:2, zinc:1, omega3:1 },
  '红豆':       { iron:2, potassium:2, magnesium:2, folate:2, zinc:1 },
  '绿豆':       { potassium:2, magnesium:1, folate:1, vitaminB1:1, iron:1 },
  '扁豆':       { folate:3, iron:2, magnesium:2, potassium:2, zinc:1, vitaminB1:1 },
  '鹰嘴豆':     { folate:3, iron:2, magnesium:2, zinc:1, potassium:2, vitaminB6:1 },
  '毛豆':       { folate:2, vitaminK:2, iron:1, magnesium:1, calcium:1, potassium:1, omega3:1 },
  // Meat & Poultry
  '鸡胸肉':     { vitaminB3:3, vitaminB6:3, selenium:2, phosphorus:2, vitaminB12:1, zinc:1 },
  '鸡腿肉':     { iron:1, zinc:2, vitaminB3:2, vitaminB6:1, vitaminB12:1 },
  '鸭肉':       { vitaminB3:2, iron:2, vitaminB1:1, vitaminB2:1, selenium:1, zinc:1 },
  '猪瘦肉':     { vitaminB1:3, vitaminB3:2, vitaminB6:1, zinc:2, selenium:1, iron:1 },
  '猪肝':       { vitaminA:3, iron:3, folate:3, vitaminB12:3, vitaminB2:3, vitaminB3:2, zinc:2, selenium:2, vitaminB6:1 },
  '鸡肝':       { vitaminA:3, iron:3, folate:3, vitaminB12:3, vitaminB2:2, selenium:2 },
  '鸡心':       { iron:2, zinc:2, vitaminB12:2, vitaminB2:2, selenium:1 },
  '羊肉':       { iron:2, zinc:2, vitaminB12:2, vitaminB3:1, selenium:1 },
  // Seafood
  '虾':         { selenium:3, vitaminB12:2, zinc:1, iodine:1, omega3:1, iron:1 },
  '鲭鱼':       { omega3:3, vitaminD:3, vitaminB12:3, selenium:2, vitaminB3:1 },
  '沙丁鱼':     { calcium:3, vitaminD:3, omega3:3, vitaminB12:2, selenium:2, iron:1 },
  '鳕鱼':       { vitaminB12:2, selenium:2, iodine:2, omega3:1, vitaminD:1, vitaminB3:1 },
  '金枪鱼':     { vitaminB3:3, selenium:3, omega3:2, vitaminB12:2, vitaminD:1, vitaminB6:1 },
  '鲈鱼':       { omega3:2, vitaminB12:2, selenium:1, vitaminD:1, vitaminB3:1 },
  '带鱼':       { omega3:2, vitaminB12:2, selenium:1, calcium:1 },
  '蛤蜊':       { iron:3, zinc:2, vitaminB12:3, selenium:2, iodine:1 },
  '扇贝':       { vitaminB12:3, selenium:3, zinc:1, iodine:1, omega3:1 },
  '鱿鱼':       { selenium:2, vitaminB12:1, zinc:1, iron:1, omega3:1 },
  // Nuts & Seeds
  '腰果':       { magnesium:2, zinc:1, iron:1, vitaminB1:1, vitaminK:1, selenium:1 },
  '葵花籽':     { vitaminE:3, magnesium:3, selenium:2, vitaminB1:2, zinc:1, vitaminB6:1 },
  '芝麻':       { calcium:3, iron:2, magnesium:2, zinc:1, vitaminE:1, omega3:1 },
  '芝麻酱':     { calcium:3, iron:2, magnesium:2, vitaminE:1, zinc:1, omega3:1 },
  '亚麻籽':     { omega3:3, magnesium:2, vitaminB1:1, vitaminE:1, zinc:1 },
  '奇亚籽':     { omega3:3, calcium:2, magnesium:2, iron:1, potassium:1 },
  '花生':       { vitaminB3:3, vitaminE:1, magnesium:2, zinc:1, folate:1, iron:1 },
  '巴西坚果':   { selenium:3, magnesium:2, vitaminE:1, zinc:1 },
  // Others
  '酸奶':       { calcium:3, vitaminB12:1, vitaminB2:1, iodine:1, zinc:1, potassium:1 },
  '奶酪':       { calcium:3, vitaminA:1, vitaminB12:1, zinc:1, selenium:1 },
  '蜂蜜':       {},
  '抹茶':       { vitaminA:1, vitaminC:1, vitaminE:1, lutein:1, vitaminK:1 },
  '姜黄':       { iron:1 },
  '绿茶':       { lutein:1, vitaminC:1 },
  // More vegetables — verified against Chinese food composition table
  '小白菜/油菜': { calcium:3, vitaminK:3, vitaminA:2, vitaminC:2, folate:1, iron:1, lutein:1 },
  '苋菜':       { calcium:2, iron:2, vitaminK:3, vitaminA:2, magnesium:2, vitaminC:1 },
  '空心菜':     { vitaminA:2, iron:1, calcium:1, vitaminC:1, lutein:1, magnesium:1 },
  '芥蓝':       { calcium:3, vitaminK:3, vitaminC:2, vitaminA:1, lutein:1 },
  '茼蒿':       { vitaminA:2, vitaminK:2, folate:1, potassium:1, iron:1 },
  '韭菜':       { vitaminK:2, vitaminA:1, vitaminC:1, folate:1, lutein:1 },
  '生菜':       { vitaminK:2, vitaminA:1, folate:1, lutein:1 },
  '娃娃菜':     { calcium:1, vitaminK:2, vitaminC:1, folate:1 },
  '豆苗':       { vitaminC:2, vitaminK:2, vitaminA:1, folate:1 },
  '荷兰豆':     { vitaminC:2, vitaminK:2, folate:1, vitaminA:1, iron:1 },
  '豇豆':       { folate:2, potassium:1, vitaminC:1, magnesium:1 },
  // Soy products
  '腐竹/豆腐皮': { calcium:2, iron:1, magnesium:1, potassium:1, zinc:1 },
  '豆浆':       { calcium:1, vitaminE:1, folate:1, magnesium:1 },
  // More nuts & seeds
  '松子':       { vitaminE:2, magnesium:2, zinc:1, omega3:1, potassium:1 },
  '开心果':     { vitaminB6:2, potassium:2, lutein:1, magnesium:1, vitaminB1:1 },
  '榛子':       { vitaminE:2, magnesium:2, vitaminB1:1, vitaminB6:1, potassium:1 },
  // More seafood
  '鳗鱼':       { vitaminA:3, vitaminD:2, omega3:2, vitaminB12:2, vitaminE:1, selenium:1 },
  '黄鳝':       { iron:2, vitaminB12:2, zinc:1, selenium:1, omega3:1, vitaminA:1 },
  '泥鳅':       { iron:2, calcium:1, vitaminB12:1, selenium:1, omega3:1 },
  '螺蛳/田螺':  { iron:2, zinc:2, calcium:1, selenium:1, vitaminB12:1 },
  '海参':       { selenium:2, calcium:1, magnesium:1, zinc:1, iron:1, omega3:1 },
  '螃蟹':       { zinc:2, selenium:2, vitaminB12:1, omega3:1, copper:1 },
  // More meats
  '猪肉(瘦)':   { vitaminB1:3, vitaminB3:2, vitaminB6:1, zinc:2, selenium:1, iron:1 },
  '鹌鹑蛋':     { vitaminA:1, vitaminB2:2, vitaminB12:2, selenium:2, iron:1, lutein:1 },
  '兔肉':       { vitaminB3:2, vitaminB12:2, selenium:1, zinc:1, iron:1 },
  '驴肉':       { iron:2, zinc:2, vitaminB3:1, selenium:1 },
  // More fruits & fungi
  '山楂':       { vitaminC:3, calcium:1, potassium:1, vitaminE:1 },
  '桂圆/龙眼':  { potassium:2, iron:1, vitaminC:1, magnesium:1 },
  '桑葚':       { iron:1, vitaminC:2, vitaminE:1, lutein:1 },
  '银耳':       { iron:1, calcium:1, vitaminD:1 },
  // Aquatic plants
  // Root vegetables & tubers
  '芋头':       { potassium:2, vitaminB6:1, magnesium:1, vitaminC:1 },
  '魔芋':       { },
  '南瓜':       { vitaminA:2, lutein:2, potassium:1, vitaminC:1 },
  '冬瓜':       { potassium:1 },
  '丝瓜':       { vitaminC:1, potassium:1 },
  '苦瓜':       { vitaminC:2, folate:1, potassium:1, lutein:1 },
  '芦笋':       { folate:2, vitaminK:2, vitaminC:1, vitaminA:1, lutein:1, iron:1 },
  // More fermented/preserved
  '纳豆':       { vitaminK:3, iron:1, calcium:1, magnesium:1, omega3:1, folate:1 },
  '味噌':       { vitaminK:1, zinc:1, magnesium:1 },
// More vegetables — verified against Chinese food composition table  '小白菜/油菜': { calcium:3, vitaminK:3, vitaminA:2, vitaminC:2, folate:1, iron:1, lutein:1 },  '苋菜':       { calcium:2, iron:2, vitaminK:3, vitaminA:2, magnesium:2, vitaminC:1 },  '空心菜':     { vitaminA:2, iron:1, calcium:1, vitaminC:1, lutein:1, magnesium:1 },  '芥蓝':       { calcium:3, vitaminK:3, vitaminC:2, vitaminA:1, lutein:1 },  '茼蒿':       { vitaminA:2, vitaminK:2, folate:1, potassium:1, iron:1 },  '韭菜':       { vitaminK:2, vitaminA:1, vitaminC:1, folate:1, lutein:1 },  '生菜':       { vitaminK:2, vitaminA:1, folate:1, lutein:1 },  '娃娃菜':     { calcium:1, vitaminK:2, vitaminC:1, folate:1 },  '豆苗':       { vitaminC:2, vitaminK:2, vitaminA:1, folate:1 },  '荷兰豆':     { vitaminC:2, vitaminK:2, folate:1, vitaminA:1, iron:1 },  '豇豆':       { folate:2, potassium:1, vitaminC:1, magnesium:1 },  // Soy products  '腐竹/豆腐皮': { calcium:2, iron:1, magnesium:1, potassium:1, zinc:1 },  // More nuts & seeds  '松子':       { vitaminE:2, magnesium:2, zinc:1, omega3:1, potassium:1 },  '开心果':     { vitaminB6:2, potassium:2, lutein:1, magnesium:1, vitaminB1:1 },  '榛子':       { vitaminE:2, magnesium:2, vitaminB1:1, vitaminB6:1, potassium:1 },  // More seafood  '鳗鱼':       { vitaminA:3, vitaminD:2, omega3:2, vitaminB12:2, vitaminE:1, selenium:1 },  '黄鳝':       { iron:2, vitaminB12:2, zinc:1, selenium:1, omega3:1, vitaminA:1 },  '泥鳅':       { iron:2, calcium:1, vitaminB12:1, selenium:1, omega3:1 },  '螺蛳':       { iron:2, zinc:2, calcium:1, selenium:1, vitaminB12:1 },  '螃蟹':       { zinc:2, selenium:2, vitaminB12:1, omega3:1 },  // More meats  '鹌鹑蛋':     { vitaminA:1, vitaminB2:2, vitaminB12:2, selenium:2, iron:1, lutein:1 },  '兔肉':       { vitaminB3:2, vitaminB12:2, selenium:1, zinc:1, iron:1 },  '驴肉':       { iron:2, zinc:2, vitaminB3:1, selenium:1 },  // More fruits & fungi  '山楂':       { vitaminC:3, calcium:1, potassium:1, vitaminE:1 },  '桂圆':       { potassium:1, iron:1, vitaminC:1, magnesium:1 },  '桑葚':       { iron:1, vitaminC:2, vitaminE:1, lutein:1 },  '银耳':       { iron:1, calcium:1 },  // Root vegetables & tubers  '南瓜':       { vitaminA:2, lutein:2, potassium:1, vitaminC:1 },  '芋头':       { potassium:2, vitaminB6:1, magnesium:1, vitaminC:1 },  '苦瓜':       { vitaminC:2, folate:1, potassium:1, lutein:1 },  '芦笋':       { folate:2, vitaminK:2, vitaminC:1, vitaminA:1, lutein:1, iron:1 },  // Fermented  '纳豆':       { vitaminK:3, iron:1, calcium:1, magnesium:1, omega3:1, folate:1 },
};

/**
 * Given a list of deficient micro keys, return top 3-5 foods
 * that cover the most deficiencies, ranked by coverage score.
 */
function getTopFoodPicks(deficientKeys) {
  const scores = [];
  for (const [food, micros] of Object.entries(TOP_FOODS)) {
    let score = 0;
    const covers = [];
    for (const key of deficientKeys) {
      if (micros[key]) {
        score += micros[key];
        covers.push(key);
      }
    }
    if (covers.length > 0) {
      scores.push({ food, score, coversCount: covers.length, covers });
    }
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 5);
}

// ===== Deficiency Consequences =====
const MICRO_CONSEQUENCES = {
  vitaminA:  '夜间视力下降（夜盲症）、眼睛干涩、皮肤干燥粗糙、免疫力降低易感染',
  vitaminD:  '钙吸收不良→骨密度下降、肌肉无力酸痛、免疫力降低、情绪低落易焦虑',
  vitaminE:  '细胞抗氧化能力下降、皮肤老化加速、神经肌肉功能受损',
  vitaminK:  '凝血功能下降易出血、骨钙流失加快',
  vitaminB1: '能量代谢受阻→持续疲劳乏力、注意力不集中、手脚麻木刺痛',
  vitaminB2: '口角炎/唇炎反复发作、舌头红肿疼痛、眼睛畏光易疲劳、皮肤出油多',
  vitaminB3: '皮肤粗糙发炎、消化不良腹泻、严重时出现糙皮病、认知功能下降',
  vitaminB6: '情绪波动易怒、皮炎、贫血、睡眠质量差',
  folate:    '巨幼细胞性贫血→疲劳头晕、免疫力下降、口腔溃疡反复',
  vitaminB12:'贫血→面色苍白乏力、手脚麻木、记忆力减退、情绪低落',
  vitaminC:  '牙龈容易出血、伤口愈合缓慢、皮下易淤青、免疫力下降感冒频繁',
  calcium:   '骨密度持续下降→骨质疏松风险、肌肉抽筋、牙齿脆弱',
  iron:      '缺铁性贫血→持续疲劳乏力、面色苍白、头晕心悸、注意力涣散、免疫力下降',
  magnesium: '肌肉紧张痉挛（尤其小腿）、入睡困难/睡眠浅、焦虑烦躁、眼皮跳',
  zinc:      '伤口愈合变慢、皮肤易长痘/发炎、味觉嗅觉减退、免疫力下降',
  selenium:  '甲状腺功能受影响→代谢减慢、免疫力下降、抗氧化能力减弱',
  potassium: '肌肉无力、心跳不规律、疲劳倦怠、血压偏高',
  iodine:    '甲状腺功能减退→代谢变慢易发胖、怕冷乏力、皮肤干燥、注意力下降',
  lutein:    '黄斑色素密度下降→视疲劳加重、蓝光伤害累积、长期增加黄斑变性风险',
  omega3:    '皮肤干燥起皮、慢性炎症增加、注意力记忆力下降、眼干不适、情绪不稳',
};

// ===== Comprehensive Health Assessment =====
// Groups deficiencies by body system for holistic evaluation
const HEALTH_SYSTEMS = {
  '眼部健康':   { keys: ['vitaminA','lutein','omega3','vitaminB2'], desc: '长时间面对屏幕，若缺乏护眼营养素将加速视力疲劳和黄斑损伤' },
  '骨骼健康':   { keys: ['calcium','vitaminD','vitaminK','magnesium'], desc: '久坐少动加上缺乏骨骼营养素，骨密度可能逐年下降' },
  '免疫力':     { keys: ['vitaminC','vitaminD','zinc','selenium','vitaminA','iron'], desc: '免疫防线薄弱，容易反复感冒、感染，恢复慢' },
  '精力与抗疲劳':{ keys: ['iron','vitaminB1','vitaminB2','vitaminB3','vitaminB12','folate','iodine','magnesium'], desc: '能量代谢通路受阻，即使睡够也觉得累、脑力工作提不起劲' },
  '皮肤状态':   { keys: ['vitaminA','vitaminE','vitaminC','zinc','omega3','vitaminB2','vitaminB6'], desc: '皮肤屏障受损，容易出油长痘或干燥起皮，炎症修复慢' },
  '情绪与睡眠': { keys: ['magnesium','vitaminB6','vitaminD','omega3','vitaminB12'], desc: '神经递质合成受阻，容易出现焦虑、入睡困难或睡眠质量差' },
};

function getHealthAssessment(deficientMap) {
  const results = [];
  for (const [system, info] of Object.entries(HEALTH_SYSTEMS)) {
    const lacking = info.keys.filter(k => deficientMap[k]);
    if (lacking.length >= info.keys.length * 0.4) {
      results.push({
        system,
        lacking,
        desc: info.desc,
        level: lacking.length >= info.keys.length * 0.6 ? 'high' : 'moderate'
      });
    }
  }
  results.sort((a, b) => b.lacking.length - a.lacking.length);
  return results.slice(0, 5);
}

// ===== Food Suggestions for Deficiency =====
// Maps each micro to [{food, amount, contributes}] — practical suggestions
const MICRO_FOOD_SUGGESTIONS = {
  vitaminA:  [
    { food: '猪肝', amount: '50g', contributes: '约 2500 ug RAE' },
    { food: '胡萝卜', amount: '1根(200g)', contributes: '约 835 ug RAE' },
    { food: '红薯', amount: '1个(200g)', contributes: '约 960 ug RAE' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 950 ug RAE' },
    { food: '枸杞', amount: '20g', contributes: '约 500 ug RAE' },
  ],
  vitaminD:  [
    { food: '三文鱼', amount: '100g', contributes: '约 11 ug' },
    { food: '鲭鱼', amount: '100g', contributes: '约 8 ug' },
    { food: '沙丁鱼', amount: '100g', contributes: '约 7 ug' },
    { food: '蛋黄', amount: '2个', contributes: '约 2.2 ug' },
    { food: '晒太阳', amount: '15-30分钟', contributes: '满足大部分需求' },
  ],
  vitaminE:  [
    { food: '葵花籽', amount: '30g', contributes: '约 10 mg a-TE' },
    { food: '杏仁', amount: '20粒', contributes: '约 5.2 mg a-TE' },
    { food: '花生', amount: '50g', contributes: '约 3.5 mg a-TE' },
    { food: '牛油果', amount: '半个', contributes: '约 1.5 mg a-TE' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 3 mg a-TE' },
  ],
  vitaminK:  [
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 960 ug' },
    { food: '西兰花', amount: '1碗(150g)', contributes: '约 150 ug' },
    { food: '紫甘蓝', amount: '1碗(150g)', contributes: '约 300 ug' },
    { food: '秋葵', amount: '1碗(150g)', contributes: '约 200 ug' },
    { food: '毛豆', amount: '1碗(150g)', contributes: '约 180 ug' },
  ],
  vitaminB1: [
    { food: '猪瘦肉', amount: '100g', contributes: '约 0.9 mg' },
    { food: '燕麦', amount: '1碗(50g干)', contributes: '约 0.3 mg' },
    { food: '葵花籽', amount: '30g', contributes: '约 0.5 mg' },
    { food: '小米', amount: '1碗(50g干)', contributes: '约 0.3 mg' },
    { food: '黄豆', amount: '50g', contributes: '约 0.2 mg' },
  ],
  vitaminB2: [
    { food: '猪肝', amount: '50g', contributes: '约 1.2 mg' },
    { food: '牛奶', amount: '1杯(250ml)', contributes: '约 0.45 mg' },
    { food: '鸡蛋', amount: '2个', contributes: '约 0.3 mg' },
    { food: '蘑菇', amount: '1碗(150g)', contributes: '约 0.25 mg' },
    { food: '杏仁', amount: '20粒', contributes: '约 0.2 mg' },
  ],
  vitaminB3: [
    { food: '鸡胸肉', amount: '150g', contributes: '约 19 mg NE' },
    { food: '金枪鱼', amount: '100g', contributes: '约 15 mg NE' },
    { food: '鸭肉', amount: '150g', contributes: '约 9 mg NE' },
    { food: '花生', amount: '50g', contributes: '约 6 mg NE' },
    { food: '蘑菇', amount: '1碗(150g)', contributes: '约 5 mg NE' },
  ],
  vitaminB6: [
    { food: '鸡胸肉', amount: '150g', contributes: '约 0.9 mg' },
    { food: '金枪鱼', amount: '100g', contributes: '约 0.7 mg' },
    { food: '香蕉', amount: '2根', contributes: '约 0.8 mg' },
    { food: '土豆', amount: '1个(200g)', contributes: '约 0.6 mg' },
    { food: '鹰嘴豆', amount: '1碗(200g)', contributes: '约 0.3 mg' },
  ],
  folate:    [
    { food: '猪肝', amount: '50g', contributes: '约 165 ug DFE' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 380 ug DFE' },
    { food: '扁豆', amount: '1碗(200g)', contributes: '约 360 ug DFE' },
    { food: '鹰嘴豆', amount: '1碗(200g)', contributes: '约 340 ug DFE' },
    { food: '西兰花', amount: '1碗(150g)', contributes: '约 160 ug DFE' },
  ],
  vitaminB12:[
    { food: '蛤蜊', amount: '100g', contributes: '约 20 ug' },
    { food: '猪肝', amount: '50g', contributes: '约 13 ug' },
    { food: '三文鱼', amount: '100g', contributes: '约 3 ug' },
    { food: '牛奶', amount: '1杯(250ml)', contributes: '约 1.3 ug' },
    { food: '鸡蛋', amount: '3个', contributes: '约 1.5 ug' },
  ],
  vitaminC:  [
    { food: '猕猴桃', amount: '2个', contributes: '约 140 mg' },
    { food: '橙子', amount: '2个', contributes: '约 140 mg' },
    { food: '青椒', amount: '1个(150g)', contributes: '约 120 mg' },
    { food: '草莓', amount: '1碗(200g)', contributes: '约 120 mg' },
    { food: '木瓜', amount: '半个(300g)', contributes: '约 180 mg' },
  ],
  calcium:   [
    { food: '牛奶', amount: '1杯(250ml)', contributes: '约 300 mg' },
    { food: '豆腐', amount: '200g', contributes: '约 320 mg' },
    { food: '沙丁鱼', amount: '100g', contributes: '约 380 mg' },
    { food: '酸奶', amount: '1杯(200g)', contributes: '约 240 mg' },
    { food: '芝麻酱', amount: '15g', contributes: '约 180 mg' },
    { food: '奶酪', amount: '30g', contributes: '约 200 mg' },
  ],
  iron:      [
    { food: '猪肝', amount: '50g', contributes: '约 11 mg' },
    { food: '蛤蜊', amount: '100g', contributes: '约 14 mg' },
    { food: '牛肉', amount: '150g', contributes: '约 4 mg' },
    { food: '黑木耳', amount: '50g(干)', contributes: '约 5 mg' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 5 mg' },
  ],
  magnesium: [
    { food: '葵花籽', amount: '30g', contributes: '约 100 mg' },
    { food: '杏仁', amount: '20粒', contributes: '约 70 mg' },
    { food: '黑巧克力(70%)', amount: '40g', contributes: '约 90 mg' },
    { food: '藜麦', amount: '1碗(100g干)', contributes: '约 150 mg' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 160 mg' },
  ],
  zinc:      [
    { food: '牡蛎', amount: '6只', contributes: '约 30 mg' },
    { food: '牛肉', amount: '150g', contributes: '约 7 mg' },
    { food: '猪肝', amount: '50g', contributes: '约 2.5 mg' },
    { food: '南瓜籽', amount: '30g', contributes: '约 2.5 mg' },
    { food: '鸡腿肉', amount: '150g', contributes: '约 3 mg' },
  ],
  selenium:  [
    { food: '巴西坚果', amount: '2粒', contributes: '约 100 ug' },
    { food: '虾', amount: '100g', contributes: '约 50 ug' },
    { food: '金枪鱼', amount: '100g', contributes: '约 80 ug' },
    { food: '鸡蛋', amount: '2个', contributes: '约 30 ug' },
    { food: '蘑菇', amount: '1碗(150g)', contributes: '约 20 ug' },
  ],
  potassium: [
    { food: '土豆', amount: '1个(200g)', contributes: '约 1000 mg' },
    { food: '香蕉', amount: '2根', contributes: '约 800 mg' },
    { food: '牛油果', amount: '1个', contributes: '约 700 mg' },
    { food: '红薯', amount: '1个(200g)', contributes: '约 700 mg' },
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 900 mg' },
  ],
  iodine:    [
    { food: '海带', amount: '10g(干)', contributes: '约 200 ug' },
    { food: '紫菜', amount: '5g', contributes: '约 80 ug' },
    { food: '裙带菜', amount: '10g(干)', contributes: '约 150 ug' },
    { food: '鳕鱼', amount: '100g', contributes: '约 100 ug' },
    { food: '虾', amount: '100g', contributes: '约 50 ug' },
  ],
  lutein:    [
    { food: '菠菜', amount: '1碗(200g)', contributes: '约 10 mg' },
    { food: '枸杞', amount: '20g', contributes: '约 8 mg' },
    { food: '紫甘蓝', amount: '1碗(150g)', contributes: '约 5 mg' },
    { food: '玉米', amount: '1根', contributes: '约 0.8 mg' },
    { food: '蛋黄', amount: '3个', contributes: '约 0.4 mg' },
  ],
  omega3:    [
    { food: '三文鱼', amount: '100g', contributes: '约 2000 mg' },
    { food: '鲭鱼', amount: '100g', contributes: '约 2500 mg' },
    { food: '亚麻籽', amount: '15g', contributes: '约 3000 mg' },
    { food: '核桃', amount: '30g', contributes: '约 1800 mg' },
    { food: '奇亚籽', amount: '15g', contributes: '约 2500 mg' },
  ],
  // More vegetables — verified against Chinese food composition table
  '小白菜/油菜': { calcium:3, vitaminK:3, vitaminA:2, vitaminC:2, folate:1, iron:1, lutein:1 },
  '苋菜':       { calcium:2, iron:2, vitaminK:3, vitaminA:2, magnesium:2, vitaminC:1 },
  '空心菜':     { vitaminA:2, iron:1, calcium:1, vitaminC:1, lutein:1, magnesium:1 },
  '芥蓝':       { calcium:3, vitaminK:3, vitaminC:2, vitaminA:1, lutein:1 },
  '茼蒿':       { vitaminA:2, vitaminK:2, folate:1, potassium:1, iron:1 },
  '韭菜':       { vitaminK:2, vitaminA:1, vitaminC:1, folate:1, lutein:1 },
  '生菜':       { vitaminK:2, vitaminA:1, folate:1, lutein:1 },
  '娃娃菜':     { calcium:1, vitaminK:2, vitaminC:1, folate:1 },
  '豆苗':       { vitaminC:2, vitaminK:2, vitaminA:1, folate:1 },
  '荷兰豆':     { vitaminC:2, vitaminK:2, folate:1, vitaminA:1, iron:1 },
  '豇豆':       { folate:2, potassium:1, vitaminC:1, magnesium:1 },
  // Soy products
  '腐竹/豆腐皮': { calcium:2, iron:1, magnesium:1, potassium:1, zinc:1 },
  '豆浆':       { calcium:1, vitaminE:1, folate:1, magnesium:1 },
  '毛豆':       { folate:2, vitaminK:2, iron:1, magnesium:1, calcium:1, potassium:1, omega3:1 },
  // More nuts & seeds
  '松子':       { vitaminE:2, magnesium:2, zinc:1, omega3:1, potassium:1 },
  '开心果':     { vitaminB6:2, potassium:2, lutein:1, magnesium:1, vitaminB1:1 },
  '榛子':       { vitaminE:2, magnesium:2, vitaminB1:1, vitaminB6:1, potassium:1 },
  // More seafood
  '鳗鱼':       { vitaminA:3, vitaminD:2, omega3:2, vitaminB12:2, vitaminE:1, selenium:1 },
  '黄鳝':       { iron:2, vitaminB12:2, zinc:1, selenium:1, omega3:1, vitaminA:1 },
  '泥鳅':       { iron:2, calcium:1, vitaminB12:1, selenium:1, omega3:1 },
  '螺蛳/田螺':  { iron:2, zinc:2, calcium:1, selenium:1, vitaminB12:1 },
  '海参':       { selenium:2, calcium:1, magnesium:1, zinc:1, iron:1, omega3:1 },
  '螃蟹':       { zinc:2, selenium:2, vitaminB12:1, omega3:1, copper:1 },
  '牡蛎':       { zinc:3, iron:2, vitaminB12:2, selenium:2, iodine:1 },
  // More meats
  '猪肉(瘦)':   { vitaminB1:3, vitaminB3:2, vitaminB6:1, zinc:2, selenium:1, iron:1 },
  '鹌鹑蛋':     { vitaminA:1, vitaminB2:2, vitaminB12:2, selenium:2, iron:1, lutein:1 },
  '兔肉':       { vitaminB3:2, vitaminB12:2, selenium:1, zinc:1, iron:1 },
  '驴肉':       { iron:2, zinc:2, vitaminB3:1, selenium:1 },
  // More fruits & fungi
  '山楂':       { vitaminC:3, calcium:1, potassium:1, vitaminE:1 },
  '桂圆/龙眼':  { potassium:2, iron:1, vitaminC:1, magnesium:1 },
  '桑葚':       { iron:1, vitaminC:2, vitaminE:1, lutein:1 },
  '银耳':       { iron:1, calcium:1, vitaminD:1 },
  // Aquatic plants
  '海带':       { iodine:3, calcium:1, iron:1, magnesium:1, omega3:1 },
  '紫菜':       { iodine:3, vitaminB12:1, iron:1, calcium:1, omega3:2 },
  '裙带菜':     { iodine:3, calcium:2, magnesium:1, iron:1, omega3:2 },
  // Root vegetables & tubers
  '芋头':       { potassium:2, vitaminB6:1, magnesium:1, vitaminC:1 },
  '魔芋':       { },
  '南瓜':       { vitaminA:2, lutein:2, potassium:1, vitaminC:1 },
  '冬瓜':       { potassium:1 },
  '丝瓜':       { vitaminC:1, potassium:1 },
  '苦瓜':       { vitaminC:2, folate:1, potassium:1, lutein:1 },
  '芦笋':       { folate:2, vitaminK:2, vitaminC:1, vitaminA:1, lutein:1, iron:1 },
  // More fermented/preserved
  '纳豆':       { vitaminK:3, iron:1, calcium:1, magnesium:1, omega3:1, folate:1 },
  '味噌':       { vitaminK:1, zinc:1, magnesium:1 },
};

// ===== Formatters =====

function formatMicroValue(key, val) {
  const info = MICRONUTRIENT_RDA[key];
  if (!info) return String(val);
  return val.toFixed(1) + ' ' + info.unit;
}

function formatMicroCoveragePct(coverage) {
  return Math.round(coverage * 100) + '%';
}
