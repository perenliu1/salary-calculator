<template>
  <div class="mini-mode-display">
    <div class="amount-container">
      <span class="currency">¥</span>
      <span class="amount">{{ formattedEarnings }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  form: {
    type: Object,
    required: true,
  }
});

// 辅助函数：将 "HH:mm" 时间字符串转换为从午夜开始的分钟数
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
  return hours * 60 + minutes;
};

// 计算每分钟的金额
const moneyPerMinute = computed(() => {
  if (!props.form || !props.form.salaryAmount) return 0;
  const {
    salaryType,
    salaryAmount: rawSalaryAmount,
    weeklyWorkDays: rawWeeklyWorkDays,
    nonBillingTimeSlots,
    actualStartTimeToday,
    actualEndTimeToday
  } = props.form;

  const salaryAmount = parseFloat(rawSalaryAmount);
  if (isNaN(salaryAmount) || salaryAmount < 0) return 0;
  if (salaryType === "时薪") return salaryAmount > 0 ? salaryAmount / 60 : 0;


  // 计算每日的实际计费分钟数
  const calculateDailyBillingMinutes = () => {
    const startMinutes = timeToMinutes(actualStartTimeToday);
    const endMinutes = timeToMinutes(actualEndTimeToday);

    if (endMinutes <= startMinutes) return 0;
    let totalWorkMinutesToday = endMinutes - startMinutes;
    let totalNonBillingMinutesToday = 0;
    if (nonBillingTimeSlots && Array.isArray(nonBillingTimeSlots)) {
      nonBillingTimeSlots.forEach(slot => {
        if (slot && slot.start && slot.end) {
          const slotStartMinutes = timeToMinutes(slot.start);
          const slotEndMinutes = timeToMinutes(slot.end);
          if (slotEndMinutes > slotStartMinutes) {
            const effectiveSlotStart = Math.max(startMinutes, slotStartMinutes);
            const effectiveSlotEnd = Math.min(endMinutes, slotEndMinutes);
            if (effectiveSlotEnd > effectiveSlotStart) totalNonBillingMinutesToday += (effectiveSlotEnd - effectiveSlotStart);
          }
        }
      });
    }
    const dailyBillingMinutes = totalWorkMinutesToday - totalNonBillingMinutesToday;
    return Math.max(0, dailyBillingMinutes);
  };

  const dailyBillingMinutesVal = calculateDailyBillingMinutes();
  if (dailyBillingMinutesVal <= 0) return 0;

  if (salaryType === "日薪") return salaryAmount / dailyBillingMinutesVal;
  if (salaryType === "月薪") {
    const weeklyWorkDays = parseInt(rawWeeklyWorkDays);
    // 计算当前月份的工作日天数
    const getWorkingDaysInCurrentMonth = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();

      const daysInMonth = new Date(year, month + 1, 0).getDate();   // 获取当月总天数
      let workingDaysCount = 0;
      const numRestDays = 7 - weeklyWorkDays;
      const restDaysOfWeek = [];  // 休息日的星期数
      if (numRestDays >= 1) restDaysOfWeek.push(0); // 周日
      if (numRestDays >= 2) restDaysOfWeek.push(6); // 周六
      if (numRestDays >= 3) restDaysOfWeek.push(5); // 周五
      if (numRestDays >= 4) restDaysOfWeek.push(4); // 周四
      if (numRestDays >= 5) restDaysOfWeek.push(3); // 周三
      if (numRestDays >= 6) restDaysOfWeek.push(2); // 周二

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayOfWeek = currentDate.getDay();
        if (!restDaysOfWeek.includes(dayOfWeek)) workingDaysCount++;
      }
      return workingDaysCount;
    };

    const workingDaysThisMonth = getWorkingDaysInCurrentMonth();
    const totalMonthlyBillingMinutes = dailyBillingMinutesVal * workingDaysThisMonth;
    if (totalMonthlyBillingMinutes <= 0) return 0;
    return salaryAmount / totalMonthlyBillingMinutes;
  }

  return 0; // 未知薪资类型或其他情况
});

const currentEarningsToday = ref(0);
const formattedEarnings = computed(() => currentEarningsToday.value.toFixed(3));
let earningsUpdateIntervalId = null;

// 为今天的特定 "HH:MM" 时间获取一个完整的 Date 对象
const getFullDateForTimeToday = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    const d = new Date();
    d.setHours(0,0,0,0);
    console.warn("Invalid time string for getFullDateForTimeToday:", timeStr);
    return d;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// 更新当前收益的函数
const updateCurrentEarnings = () => {
  const mpm = moneyPerMinute.value; // 每分钟收益
  const {
    actualStartTimeToday,
    actualEndTimeToday,
    nonBillingTimeSlots
  } = props.form;

  const moneyPerSecond = mpm / 60;
  const moneyPerHalfSecond = moneyPerSecond * 0.5; // 每0.5秒的收益

  const now = new Date(); // 当前时间
  const workStartTimeDate = getFullDateForTimeToday(actualStartTimeToday); // 今天工作开始时间
  const scheduledEndWorkTimeDate = getFullDateForTimeToday(actualEndTimeToday); // 今天计划工作结束时间

  // 如果当前时间还未到工作开始时间，则收益为0
  if (now <= workStartTimeDate) {
    currentEarningsToday.value = 0;
    return;
  }

  // 计算的有效截止时间：取当前时间和计划下班时间的较早者
  const effectiveCurrentTime = now < scheduledEndWorkTimeDate ? now : scheduledEndWorkTimeDate;

  // 如果有效截止时间早于或等于工作开始时间（例如，当前已过下班时间，且下班时间早于上班时间 - 异常数据）
  if (effectiveCurrentTime <= workStartTimeDate) {
    currentEarningsToday.value = 0;
    return;
  }

  // 1. 计算从工作开始到有效截止时间的总毫秒数
  let totalElapsedMsInWindow = effectiveCurrentTime.getTime() - workStartTimeDate.getTime();

  // 2. 计算在此窗口内的总不计费毫秒数
  let totalNonBillableMsInWindow = 0;
  if (nonBillingTimeSlots && Array.isArray(nonBillingTimeSlots)) {
    for (const slot of nonBillingTimeSlots) {
      if (slot && slot.start && slot.end) {
        const slotStart = getFullDateForTimeToday(slot.start);
        const slotEnd = getFullDateForTimeToday(slot.end);

        // 计算不计费时段与 [workStartTimeDate, effectiveCurrentTime] 的重叠部分
        const overlapStartMs = Math.max(workStartTimeDate.getTime(), slotStart.getTime());
        const overlapEndMs = Math.min(effectiveCurrentTime.getTime(), slotEnd.getTime());

        if (overlapEndMs > overlapStartMs) {
          totalNonBillableMsInWindow += (overlapEndMs - overlapStartMs);
        }
      }
    }
  }

  // 3. 计算总的实际计费毫秒数
  const totalBillableMsSoFar = Math.max(0, totalElapsedMsInWindow - totalNonBillableMsInWindow);

  // 4. 将总计费毫秒数转换为完成了多少个0.5秒的块
  const totalBillableSecondsSoFar = totalBillableMsSoFar / 1000;
  const numberOfBillableHalfSeconds = Math.floor(totalBillableSecondsSoFar / 0.5);

  // 5. 计算总收益
  const earnings = numberOfBillableHalfSeconds * moneyPerHalfSecond;
  currentEarningsToday.value = parseFloat(earnings.toFixed(3)); // 更新响应式数据，保留三位小数
};

onMounted(() => {
  updateCurrentEarnings();
  earningsUpdateIntervalId = setInterval(updateCurrentEarnings, 500);
});

onUnmounted(() => {
  if (earningsUpdateIntervalId) {
    clearInterval(earningsUpdateIntervalId);
  }
});

watch(() => props.form, () => {
  updateCurrentEarnings();
}, { deep: true });
</script>

<style scoped>
.mini-mode-display {
  width: 100%;
  height: 100vh;
  display: flex;
  background-color: transparent;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  color: #ecf0f1;
  overflow: hidden;
}

.amount-container {
  text-align: center;
  margin-bottom: 10px;
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.amount, .currency {
  font-size: 60px;
  font-weight: 700;
  color: #1abc9c;
  opacity: 0.15;
  -webkit-text-stroke-width: 0.5px;
  -webkit-text-stroke-color: black;
  paint-order: stroke fill;
}

.currency {
  font-size: 28px;
  font-weight: 500;
  margin-right: 5px;
}
</style>
