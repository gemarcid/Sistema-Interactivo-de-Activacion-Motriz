<script setup>
defineProps({
  arms: { type: String, required: true },
})
</script>

<template>
  <svg viewBox="0 0 80 88" aria-hidden="true" fill="none">
    <circle cx="40" cy="17" r="9" fill="currentColor" />
    <path
      d="M28 35H52 M40 35V60L30 81 M40 60L50 81"
      stroke="currentColor"
      stroke-width="6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path :d="arms" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
