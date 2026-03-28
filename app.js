const STORAGE_KEY = "walkingManData";
const LEGACY_STORAGE_KEYS = ["walkingAppData"];
const DEFAULT_GOAL_STEPS = 50000;
const DEFAULT_TRAILING_AVERAGE_STEPS = 3000;
const STEPS_LIMIT = 100000;
const GOAL_LIMIT = 200000;
const numberFormatter = new Intl.NumberFormat("ja-JP");

const elements = {
  goalCurrent: document.getElementById("goalCurrent"),
  goalInput: document.getElementById("goalInput"),
  goalSaveBtn: document.getElementById("goalSaveBtn"),
  weekTotal: document.getElementById("weekTotal"),
  weekAverage: document.getElementById("weekAverage"),
  trailingWeekAverage: document.getElementById("trailingWeekAverage"),
  progressRate: document.getElementById("progressRate"),
  requiredPerDay: document.getElementById("requiredPerDay"),
  prevWeekTotal: document.getElementById("prevWeekTotal"),
  streakInfo: document.getElementById("streakInfo"),
  dateInput: document.getElementById("dateInput"),
  stepsInput: document.getElementById("stepsInput"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  messageArea: document.getElementById("messageArea")
};

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date key");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (formatDateKey(date) !== dateKey) {
    throw new Error("Invalid date value");
  }

  return date;
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getWeekStart(date) {
  const base = cloneDate(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function getPrevWeekStart(weekStart) {
  return addDays(weekStart, -7);
}

function getWeekEnd(weekStart) {
  return addDays(weekStart, 6);
}

function isDateInWeek(target, weekStart) {
  const targetKey = formatDateKey(target);
  const startKey = formatDateKey(weekStart);
  const endKey = formatDateKey(getWeekEnd(weekStart));
  return targetKey >= startKey && targetKey <= endKey;
}

function getElapsedDaysInWeek(today) {
  const day = today.getDay();
  return day === 0 ? 7 : day;
}

function getRemainingDaysInWeek(today) {
  return 7 - getElapsedDaysInWeek(today);
}

function formatIsoLocal(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMins = String(absoluteOffset % 60).padStart(2, "0");

  return [
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`,
    `${sign}${offsetHours}:${offsetMins}`
  ].join("");
}

function getRuntimeContext() {
  const today = getToday();
  const currentWeekStart = getWeekStart(today);
  const prevWeekStart = getPrevWeekStart(currentWeekStart);

  return {
    today,
    todayKey: formatDateKey(today),
    currentWeekStart,
    currentWeekStartKey: formatDateKey(currentWeekStart),
    prevWeekStart,
    prevWeekStartKey: formatDateKey(prevWeekStart)
  };
}

function getWeekStartKeyFromDateKey(dateKey) {
  return formatDateKey(getWeekStart(parseDateKey(dateKey)));
}

function normalizeDailySteps(rawDailySteps) {
  if (!isPlainObject(rawDailySteps)) {
    return {};
  }

  const result = {};

  for (const [dateKey, rawSteps] of Object.entries(rawDailySteps)) {
    try {
      parseDateKey(dateKey);
    } catch (error) {
      continue;
    }

    if (!Number.isInteger(rawSteps) || rawSteps < 0) {
      continue;
    }

    result[dateKey] = rawSteps;
  }

  return result;
}

function normalizeWeeklyHistory(rawWeeklyHistory) {
  if (!isPlainObject(rawWeeklyHistory)) {
    return {};
  }

  const result = {};

  for (const [weekKey, entry] of Object.entries(rawWeeklyHistory)) {
    try {
      parseDateKey(weekKey);
    } catch (error) {
      continue;
    }

    if (!isPlainObject(entry)) {
      continue;
    }

    if (!Number.isInteger(entry.totalSteps) || entry.totalSteps < 0) {
      continue;
    }

    if (!Number.isInteger(entry.goalSteps) || entry.goalSteps < 1) {
      continue;
    }

    if (typeof entry.achieved !== "boolean") {
      continue;
    }

    result[weekKey] = {
      totalSteps: entry.totalSteps,
      goalSteps: entry.goalSteps,
      achieved: entry.achieved,
      fixedAt: typeof entry.fixedAt === "string" ? entry.fixedAt : formatIsoLocal(new Date())
    };
  }

  return result;
}

function normalizeData(rawData) {
  const base = isPlainObject(rawData) ? rawData : {};
  const goalSteps = Number.isInteger(base.goalSteps) && base.goalSteps > 0 ? base.goalSteps : DEFAULT_GOAL_STEPS;

  return {
    goalSteps,
    dailySteps: normalizeDailySteps(base.dailySteps),
    weeklyHistory: normalizeWeeklyHistory(base.weeklyHistory)
  };
}

function loadData() {
  try {
    const candidates = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];

    for (const key of candidates) {
      const saved = localStorage.getItem(key);
      if (!saved) {
        continue;
      }

      return normalizeData(JSON.parse(saved));
    }

    return normalizeData(null);
  } catch (error) {
    console.error("Failed to load data:", error);
    return normalizeData(null);
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function setDailySteps(data, dateKey, steps) {
  data.dailySteps[dateKey] = steps;
}

function deleteDailySteps(data, dateKey) {
  delete data.dailySteps[dateKey];
}

function getDailySteps(data, dateKey) {
  return Number.isInteger(data.dailySteps[dateKey]) ? data.dailySteps[dateKey] : null;
}

function cleanupOldDailySteps(data, currentWeekStartKey, prevWeekStartKey) {
  const currentWeekStart = parseDateKey(currentWeekStartKey);
  const prevWeekStart = parseDateKey(prevWeekStartKey);

  for (const dateKey of Object.keys(data.dailySteps)) {
    try {
      const targetDate = parseDateKey(dateKey);
      if (!isDateInWeek(targetDate, currentWeekStart) && !isDateInWeek(targetDate, prevWeekStart)) {
        delete data.dailySteps[dateKey];
      }
    } catch (error) {
      delete data.dailySteps[dateKey];
    }
  }
}

function buildWeekHistoryEntry(totalSteps, goalSteps) {
  return {
    totalSteps,
    goalSteps,
    achieved: totalSteps >= goalSteps,
    fixedAt: formatIsoLocal(new Date())
  };
}

function calculateWeekTotal(data, weekStart, options = {}) {
  const startKey = formatDateKey(weekStart);
  const endKey = formatDateKey(getWeekEnd(weekStart));
  const untilKey = options.untilDate ? formatDateKey(options.untilDate) : null;

  return Object.entries(data.dailySteps).reduce((sum, [dateKey, steps]) => {
    if (dateKey < startKey || dateKey > endKey) {
      return sum;
    }

    if (untilKey && dateKey > untilKey) {
      return sum;
    }

    return sum + steps;
  }, 0);
}

function calculateCurrentWeekTotal(data, currentWeekStart, today) {
  return calculateWeekTotal(data, currentWeekStart, { untilDate: today });
}

function calculatePreviousWeekTotal(data, prevWeekStart) {
  return calculateWeekTotal(data, prevWeekStart);
}

function rebuildPreviousWeekHistory(data, prevWeekStartKey) {
  const prevWeekStart = parseDateKey(prevWeekStartKey);
  const totalSteps = calculatePreviousWeekTotal(data, prevWeekStart);
  const hasAnyDailyEntry = Object.keys(data.dailySteps).some((dateKey) => isDateInWeek(parseDateKey(dateKey), prevWeekStart));

  if (!hasAnyDailyEntry) {
    delete data.weeklyHistory[prevWeekStartKey];
    return;
  }

  data.weeklyHistory[prevWeekStartKey] = buildWeekHistoryEntry(totalSteps, data.goalSteps);
}

function finalizeElapsedDailyWeeks(data, prevWeekStartKey) {
  const staleWeekKeys = [...new Set(
    Object.keys(data.dailySteps)
      .map((dateKey) => {
        try {
          return getWeekStartKeyFromDateKey(dateKey);
        } catch (error) {
          return null;
        }
      })
      .filter((weekKey) => weekKey && weekKey < prevWeekStartKey)
  )];

  for (const weekKey of staleWeekKeys) {
    if (data.weeklyHistory[weekKey]) {
      continue;
    }

    const totalSteps = calculatePreviousWeekTotal(data, parseDateKey(weekKey));
    data.weeklyHistory[weekKey] = buildWeekHistoryEntry(totalSteps, data.goalSteps);
  }
}

function calculateCurrentWeekAverage(currentWeekTotal, elapsedDays) {
  if (elapsedDays <= 0) {
    return 0;
  }

  return Math.round(currentWeekTotal / elapsedDays);
}

function calculateTrailingSevenDayAverage(data, endDate, fallbackSteps = DEFAULT_TRAILING_AVERAGE_STEPS) {
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const dateKey = formatDateKey(addDays(endDate, -offset));
    const steps = getDailySteps(data, dateKey);
    total += steps === null ? fallbackSteps : steps;
  }

  return Math.round(total / 7);
}

function calculateProgressRate(currentWeekTotal, goalSteps) {
  if (goalSteps <= 0) {
    return 0;
  }

  return (currentWeekTotal / goalSteps) * 100;
}

function calculateRequiredPerDay(currentWeekTotal, goalSteps, remainingDays) {
  const remainingSteps = goalSteps - currentWeekTotal;

  if (remainingSteps <= 0) {
    return 0;
  }

  if (remainingDays === 0) {
    return "---";
  }

  return Math.ceil(remainingSteps / remainingDays);
}

function calculateStreak(weeklyHistory) {
  const weekKeys = Object.keys(weeklyHistory).sort().reverse();

  if (weekKeys.length === 0) {
    return { type: "none", count: 0 };
  }

  const firstType = weeklyHistory[weekKeys[0]].achieved ? "achieved" : "failed";
  let count = 0;

  for (const weekKey of weekKeys) {
    const type = weeklyHistory[weekKey].achieved ? "achieved" : "failed";
    if (type !== firstType) {
      break;
    }
    count += 1;
  }

  return { type: firstType, count };
}

function validateSteps(value) {
  if (value.trim() === "") {
    return { ok: false, message: "歩数を入力" };
  }

  if (!/^\d+$/.test(value.trim())) {
    return { ok: false, message: "数字のみ" };
  }

  const steps = Number(value);

  if (!Number.isInteger(steps)) {
    return { ok: false, message: "整数のみ" };
  }

  if (steps < 0 || steps > STEPS_LIMIT) {
    return { ok: false, message: "0〜100000" };
  }

  return { ok: true, message: "" };
}

function validateGoal(value) {
  if (value.trim() === "") {
    return { ok: false, message: "目標を入力" };
  }

  if (!/^\d+$/.test(value.trim())) {
    return { ok: false, message: "数字のみ" };
  }

  const goalSteps = Number(value);

  if (!Number.isInteger(goalSteps)) {
    return { ok: false, message: "整数のみ" };
  }

  if (goalSteps < 1 || goalSteps > GOAL_LIMIT) {
    return { ok: false, message: "1〜200000" };
  }

  return { ok: true, message: "" };
}

function validateEditableDate(dateKey, currentWeekStart, prevWeekStart) {
  if (!dateKey) {
    return { ok: false, message: "日付を入力" };
  }

  let targetDate;

  try {
    targetDate = parseDateKey(dateKey);
  } catch (error) {
    return { ok: false, message: "日付が不正" };
  }

  if (isDateInWeek(targetDate, currentWeekStart) || isDateInWeek(targetDate, prevWeekStart)) {
    return { ok: true, message: "" };
  }

  return { ok: false, message: "今週/前週のみ" };
}

function formatNumber(value) {
  return numberFormatter.format(value);
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatStreak(streak) {
  if (streak.type === "achieved") {
    return `達成 ${streak.count}`;
  }

  if (streak.type === "failed") {
    return `未達 ${streak.count}`;
  }

  return "---";
}

function setMessage(message, type = "info") {
  elements.messageArea.textContent = message;
  elements.messageArea.className = `message-area is-${type}`;
}

function clearMessage() {
  elements.messageArea.textContent = "";
  elements.messageArea.className = "message-area";
}

function updateDateBounds(context) {
  elements.dateInput.min = context.prevWeekStartKey;
  elements.dateInput.max = formatDateKey(getWeekEnd(context.currentWeekStart));
}

function syncSelectedDateInput(data) {
  const dateKey = elements.dateInput.value;
  const steps = dateKey ? getDailySteps(data, dateKey) : null;
  elements.stepsInput.value = steps === null ? "" : String(steps);
}

function renderApp(data, context) {
  const currentWeekTotal = calculateCurrentWeekTotal(data, context.currentWeekStart, context.today);
  const previousWeekTotal = calculatePreviousWeekTotal(data, context.prevWeekStart);
  const elapsedDays = getElapsedDaysInWeek(context.today);
  const remainingDays = getRemainingDaysInWeek(context.today);
  const currentWeekAverage = calculateCurrentWeekAverage(currentWeekTotal, elapsedDays);
  const trailingWeekAverage = calculateTrailingSevenDayAverage(data, addDays(context.today, -1));
  const progressRate = calculateProgressRate(currentWeekTotal, data.goalSteps);
  const requiredPerDay = calculateRequiredPerDay(currentWeekTotal, data.goalSteps, remainingDays);
  const streak = calculateStreak(data.weeklyHistory);

  elements.goalCurrent.textContent = `目標 ${formatNumber(data.goalSteps)}`;
  elements.weekTotal.textContent = formatNumber(currentWeekTotal);
  elements.weekAverage.textContent = formatNumber(currentWeekAverage);
  elements.trailingWeekAverage.textContent = formatNumber(trailingWeekAverage);
  elements.progressRate.textContent = formatPercent(progressRate);
  elements.requiredPerDay.textContent =
    typeof requiredPerDay === "number" ? formatNumber(requiredPerDay) : requiredPerDay;
  elements.prevWeekTotal.textContent = formatNumber(previousWeekTotal);
  elements.streakInfo.textContent = formatStreak(streak);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

function prepareData(data, context) {
  finalizeElapsedDailyWeeks(data, context.prevWeekStartKey);
  cleanupOldDailySteps(data, context.currentWeekStartKey, context.prevWeekStartKey);
  rebuildPreviousWeekHistory(data, context.prevWeekStartKey);
}

function initializeApp() {
  const context = getRuntimeContext();
  const data = loadData();

  prepareData(data, context);
  saveData(data);

  updateDateBounds(context);
  elements.dateInput.value = context.todayKey;
  elements.goalInput.value = String(data.goalSteps);
  syncSelectedDateInput(data);
  renderApp(data, context);
  registerServiceWorker();
}

function handleDateChange() {
  clearMessage();
  syncSelectedDateInput(loadData());
}

function handleSaveSteps() {
  const context = getRuntimeContext();
  const data = loadData();
  const dateKey = elements.dateInput.value;
  const stepsValue = elements.stepsInput.value.trim();

  const dateValidation = validateEditableDate(dateKey, context.currentWeekStart, context.prevWeekStart);
  if (!dateValidation.ok) {
    setMessage(dateValidation.message, "error");
    return;
  }

  const stepsValidation = validateSteps(stepsValue);
  if (!stepsValidation.ok) {
    setMessage(stepsValidation.message, "error");
    return;
  }

  setDailySteps(data, dateKey, Number(stepsValue));
  prepareData(data, context);
  saveData(data);
  renderApp(data, context);
  syncSelectedDateInput(data);
  setMessage("保存しました", "success");
}

function handleDeleteSteps() {
  const context = getRuntimeContext();
  const data = loadData();
  const dateKey = elements.dateInput.value;

  const dateValidation = validateEditableDate(dateKey, context.currentWeekStart, context.prevWeekStart);
  if (!dateValidation.ok) {
    setMessage(dateValidation.message, "error");
    return;
  }

  if (getDailySteps(data, dateKey) === null) {
    setMessage("未登録です", "info");
    return;
  }

  deleteDailySteps(data, dateKey);
  prepareData(data, context);
  saveData(data);
  renderApp(data, context);
  syncSelectedDateInput(data);
  setMessage("削除しました", "success");
}

function handleSaveGoal() {
  const context = getRuntimeContext();
  const data = loadData();
  const goalValue = elements.goalInput.value.trim();
  const goalValidation = validateGoal(goalValue);

  if (!goalValidation.ok) {
    setMessage(goalValidation.message, "error");
    return;
  }

  data.goalSteps = Number(goalValue);
  prepareData(data, context);
  saveData(data);
  renderApp(data, context);
  elements.goalInput.value = String(data.goalSteps);
  setMessage("目標を更新しました", "success");
}

elements.dateInput.addEventListener("change", handleDateChange);
elements.saveBtn.addEventListener("click", handleSaveSteps);
elements.deleteBtn.addEventListener("click", handleDeleteSteps);
elements.goalSaveBtn.addEventListener("click", handleSaveGoal);

window.addEventListener("load", initializeApp);
