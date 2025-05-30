<template>
  <div class="setting-card">
    <el-form label-width="100px" :model="localForm">
      <el-form-item label="计薪方式">
        <el-radio-group v-model="localForm.salaryType">
          <el-radio-button label="月薪" />
          <el-radio-button label="日薪" />
          <el-radio-button label="时薪" />
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="localForm.salaryType + '金额'">
        <el-input-number v-model="localForm.salaryAmount" :precision="2" :step="100" :min="0"
          controls-position="right" />
      </el-form-item>

      <el-form-item label="每周工作天数" v-if="localForm.salaryType === '月薪'">
        <el-radio-group v-model="localForm.weeklyWorkDays">
          <el-radio-button v-for="day in 7" :key="day" :label="day" />
        </el-radio-group>
      </el-form-item>

      <el-form-item label="不计薪时段">
        <div class="slot-container">
          <div v-for="(slot, index) in localForm.nonBillingTimeSlots" :key="index">
            <el-time-picker :model-value="slot.start" @update:model-value="v => handleSlotUpdate(index, 'start', v)"
              format="HH:mm" value-format="HH:mm" :clearable="false" />
            <span>至</span>
            <el-time-picker :model-value="slot.end" @update:model-value="v => handleSlotUpdate(index, 'end', v)"
              format="HH:mm" value-format="HH:mm" :clearable="false" />
            <el-button type="danger" :icon="Delete" circle size="small" @click="handleRemoveSlot(index)"
              :disabled="localForm.nonBillingTimeSlots.length <= 1" />
          </div>
          <el-button type="primary" :icon="Plus" @click="handleAddSlot" size="small" style="width: 80px;" />
        </div>
      </el-form-item>

      <el-form-item label="今日上班时间">
        <el-time-picker v-model="localForm.actualStartTimeToday" format="HH:mm" value-format="HH:mm" :clearable="true"
          placeholder="上班时间" />
      </el-form-item>

      <el-form-item label="下班时间">
        <el-time-picker v-model="localForm.actualEndTimeToday" format="HH:mm" value-format="HH:mm" :clearable="true"
          placeholder="下班时间" />
      </el-form-item>
    </el-form>

    <div style="text-align: center;">
      <el-button type="primary" @click="handleStartCalculation">开始计算</el-button>
    </div>

    <p>所有数据均存储在您本地，不进行任何网络传输</p>
  </div>
</template>

<script setup>
import { reactive, watch, toRaw } from 'vue';
import { Delete, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const getDefaultFormState = () => ({
  salaryType: '月薪',
  salaryAmount: 0,
  weeklyWorkDays: 5,
  nonBillingTimeSlots: [{ start: '12:00', end: '14:00' }],
  actualStartTimeToday: '08:30',
  actualEndTimeToday: '18:30',
});

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  }
});
const emit = defineEmits(['startCalculation']);

const initialModelValue = JSON.parse(JSON.stringify(toRaw(props.modelValue)));
const localForm = reactive({
  ...getDefaultFormState(),
  ...initialModelValue
});

watch(() => props.modelValue, (newValFromPropRaw) => {
  const newPropState = JSON.parse(JSON.stringify(toRaw(newValFromPropRaw)));
  const newCompletePropState = {
    ...getDefaultFormState(),
    ...newPropState
  };
  Object.assign(localForm, newCompletePropState);
}, { deep: true });

// 更新时间段
const handleSlotUpdate = (index, field, value) => {
  const newSlots = localForm.nonBillingTimeSlots.map((slot, i) =>
    i === index ? { ...slot, [field]: value } : slot
  );
  localForm.nonBillingTimeSlots = newSlots;
};
// 添加时间段
const handleAddSlot = () => {
  const lastSlot = localForm.nonBillingTimeSlots[localForm.nonBillingTimeSlots.length - 1];
  const lastEndTime = lastSlot ? lastSlot.end : '12:00';
  localForm.nonBillingTimeSlots.push({ start: lastEndTime, end: lastEndTime });
};
// 删除时间段
const handleRemoveSlot = (index) => {
  if (localForm.nonBillingTimeSlots.length <= 1) return;
  localForm.nonBillingTimeSlots.splice(index, 1);
};
// 验证时间段列表
const validateNonBillingSlots = (slots) => {
  if (!slots || slots.length === 0) return "不计薪时段列表不能为空";
  const sortedSlots = [...slots].sort((a, b) => {
    if (!a.start || !b.start) return 0;
    return a.start.localeCompare(b.start);
  });
  for (let i = 0; i < sortedSlots.length; i++) {
    const currentSlot = sortedSlots[i];
    if (!currentSlot.start || !currentSlot.end) return `不计薪时段未完整设置时间`;
    if (currentSlot.start >= currentSlot.end) return `不计薪时段 #${i + 1} 开始时间必须早于结束时间`;
    if (i > 0) {
      const prevSlot = sortedSlots[i - 1];
      if (prevSlot.end > currentSlot.start) return `不计薪时段存在重叠或顺序错误 (时段 #${i} 与时段 #${i + 1})`;
    }
  }
  return null;
};

const handleStartCalculation = () => {
  const validationError = validateNonBillingSlots(localForm.nonBillingTimeSlots);
  if (validationError) {
    ElMessage.error(validationError);
    return;
  }
  if (localForm.salaryAmount <= 0 && (localForm.salaryType === '月薪' || localForm.salaryType === '日薪' || localForm.salaryType === '时薪')) {
    ElMessage.error('薪资金额必须大于0');
    return;
  }
  if (!localForm.actualStartTimeToday) {
    ElMessage.error('请设置今日上班时间');
    return;
  }
  if (!localForm.actualEndTimeToday) {
    ElMessage.error('请设置今日下班时间');
    return;
  }
  if (localForm.actualStartTimeToday >= localForm.actualEndTimeToday) {
    ElMessage.error('今日下班时间必须晚于上班时间');
    return;
  }
  emit('startCalculation', JSON.parse(JSON.stringify(toRaw(localForm))));
};
</script>

<style scoped>
.setting-card {
  padding: 10px;
  background-color: #fff;
  border-radius: 8px;
}

.setting-card .el-form-item {
  margin-bottom: 18px;
}

.slot-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.slot-container>div {
  display: flex;
  align-items: center;
  gap: 8px;
}

p {
  font-size: 12px;
  color: #909399;
  margin-top: 10px;
  text-align: center;
}
</style>

<style>
.setting-card .el-date-editor.el-input,
.setting-card .el-date-editor.el-input__inner {
  width: 100px !important;
}

.setting-card .el-input-number {
  width: 150px;
}

.setting-card .el-radio-group .el-radio-button__inner {
  padding: 8px 11px;
}
</style>
