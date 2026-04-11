<template>
  <Teleport to="body">
    <div v-if="isMaintenanceMode" class="maintenance-overlay" role="alertdialog" aria-modal="true" aria-labelledby="maintenance-title" aria-describedby="maintenance-desc">
      <div class="maintenance-modal">
        <div class="maintenance-icon">🔧</div>
        <h2 id="maintenance-title" class="maintenance-title">Website Under Maintenance</h2>
        <p id="maintenance-desc" class="maintenance-message">
          We are currently performing scheduled maintenance to improve your experience.
          The website will be back online shortly.
        </p>
        <p class="maintenance-note">We apologize for the inconvenience. Thank you for your patience.</p>
        <div class="maintenance-divider"></div>
        <p class="maintenance-contact">
          For urgent matters, please visit our
          <a href="https://github.com/DIT2D-PUO-2026/pka2xml" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true'
</script>

<style scoped>
.maintenance-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: rgba(0, 0, 0, 0.45);
}

.maintenance-modal {
  background: var(--vp-c-bg);
  border-radius: 16px;
  padding: 52px 44px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--vp-c-divider);
}

.maintenance-icon {
  font-size: 3.5rem;
  margin-bottom: 20px;
  display: block;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.maintenance-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 16px;
  padding: 0;
  border: none;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
}

.maintenance-message {
  color: var(--vp-c-text-2);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0 0 12px;
}

.maintenance-note {
  color: var(--vp-c-text-3);
  font-size: 0.875rem;
  margin: 0;
}

.maintenance-divider {
  height: 1px;
  background: var(--vp-c-divider);
  margin: 24px 0;
}

.maintenance-contact {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
  margin: 0;
}

.maintenance-contact a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.maintenance-contact a:hover {
  text-decoration: underline;
}
</style>
