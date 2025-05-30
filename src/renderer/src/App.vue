<template>
  <el-config-provider>
    <SalarySettingsForm v-if="!isMiniMode" :modelValue="form" @startCalculation="handleStartCalculation" />
    <MiniModeDisplay v-else :form="form" @click="handleStartCalculation(form)" />
  </el-config-provider>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue';
import SalarySettingsForm from './components/SalarySettingsForm.vue';
import MiniModeDisplay from './components/MiniModeDisplay.vue';

const store = {
  set: (data) => window.appApi?.saveSettings(data),
  get: () => window.appApi?.loadSettings()
};

const getDefaultAppSettings = () => ({
  salaryType: '月薪',
  salaryAmount: 0,
  weeklyWorkDays: 5,
  nonBillingTimeSlots: [{ start: '12:00', end: '14:00' }],
  actualStartTimeToday: '08:30',
  actualEndTimeToday: '18:30',
});

const form = reactive({ ...getDefaultAppSettings() });
const isMiniMode = ref(false);

// 更新表单数据
const handleStartCalculation = (newFormValues) => {
  Object.assign(form, newFormValues);
  window.appApi?.toggleMiniMode();
};

// 加载设置
const loadSettings = async () => {
  const defaults = getDefaultAppSettings();
  const loadedSettings = await store.get();
  const savedSettingsToSpread = (loadedSettings && typeof loadedSettings === 'object')
    ? loadedSettings : {};
  Object.assign(form, {
    ...defaults,
    ...savedSettingsToSpread
  });
};
// 保存设置
const saveSettings = () => {
  store.set(JSON.parse(JSON.stringify(form)))
};
// 组件挂载后执行
onMounted(async () => {
  await loadSettings();
  window.appApi.onMiniModeChanged((state) => isMiniMode.value = state)
  window.appApi.getInitialMiniModeState().then(state => isMiniMode.value = state)
  watch(form, saveSettings, { deep: true });
});
</script>

<style>
* {
  font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  margin: 0;
  padding: 0;
}
</style>
