<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="counter">
    <p role="status">Aantal klikken: <strong>{{ count }}</strong></p>
    <div class="actions">
      <button type="button" @click="count++">Klik om te verhogen</button>
      <button type="button" class="secondary" :disabled="count === 0" @click="count = 0">
        Opnieuw
      </button>
    </div>
  </div>
</template>
