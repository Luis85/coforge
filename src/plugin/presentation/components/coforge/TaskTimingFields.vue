<script setup lang="ts">
import { useTaskSchedulerForm } from '../../composables/coforge/use-task-scheduler';
const model = useTaskSchedulerForm();
</script>
<template>
  <template v-if="model.store.form">
    <label class="cf-field"><span>Timing</span><select v-model="model.store.form.timing">
      <option value="once">One-time timer</option><option value="interval">Repeating interval</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
    </select></label>
    <template v-if="model.store.form.timing === 'once' || model.store.form.timing === 'interval'">
      <label class="cf-field"><span>{{ model.store.form.timing === 'once' ? 'Run at' : 'First run at' }} · {{ model.deviceZone }}</span><input v-model="model.store.form.at" type="datetime-local" step="1" required></label>
      <div v-if="model.store.form.timing === 'once'" class="cf-council-fields">
        <label class="cf-field"><span>Set a delay from now</span><input v-model.number="model.store.delay" type="number" min="1" max="31536000" step="1"></label>
        <label class="cf-field"><span>Delay unit</span><select v-model.number="model.store.delayUnit"><option :value="1">Seconds</option><option :value="60">Minutes</option><option :value="3600">Hours</option><option :value="86400">Days</option></select></label>
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.setDelay()">Set timer from now</button>
      </div>
      <div v-else class="cf-council-fields">
        <label class="cf-field"><span>Repeat every</span><input v-model.number="model.store.form.every" type="number" min="1" max="31536000" step="1" required></label>
        <label class="cf-field"><span>Interval unit</span><select v-model.number="model.store.form.unit"><option :value="1">Seconds</option><option :value="60">Minutes</option><option :value="3600">Hours</option><option :value="86400">Days</option></select></label>
      </div>
    </template>
    <template v-else>
      <div class="cf-council-fields">
        <label class="cf-field"><span>Time</span><input v-model="model.store.form.time" type="time" required></label>
        <label class="cf-field"><span>Saved timezone</span><input v-model="model.store.form.timeZone" maxlength="100" required placeholder="Europe/Berlin"></label>
      </div>
      <fieldset v-if="model.store.form.timing === 'weekly'" class="cf-task-form"><legend>Run on days</legend><div class="cf-settings-actions">
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="1"> Mon</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="2"> Tue</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="3"> Wed</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="4"> Thu</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="5"> Fri</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="6"> Sat</label>
        <label class="cf-check"><input v-model="model.store.form.weekdays" type="checkbox" :value="0"> Sun</label>
      </div></fieldset>
      <p class="cf-settings-help">The timezone stays fixed when your device timezone changes. Missing DST times are skipped; repeated times run once.</p>
    </template>
  </template>
</template>
