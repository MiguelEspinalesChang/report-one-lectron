<script setup lang="ts">
import SystemStatus from './islands/Dashboard/SystemStatus.vue'
import DeviceLive from './islands/Devices/DeviceLive.vue'

const hasBridge = 'platform' in window
</script>

<template>
  <main class="app">
    <h1>Desktop Platform</h1>
    <p v-if="!hasBridge" class="warning">
      Bridge not available — open this UI through the Electron shell, not a plain browser.
    </p>
    <template v-else>
      <SystemStatus />
      <DeviceLive />
    </template>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f5f6f8;
  color: #1c1e21;
}

.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.island {
  background: #fff;
  border: 1px solid #e0e2e6;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.warning {
  color: #92400e;
  background: #fef3c7;
  border-radius: 6px;
  padding: 0.75rem 1rem;
}

.error {
  color: #b91c1c;
}

button {
  cursor: pointer;
  padding: 0.4rem 0.9rem;
  border: 1px solid #cbd0d6;
  border-radius: 6px;
  background: #fff;
}

button:hover {
  background: #f0f1f3;
}
</style>
