<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import MaintenanceBanner from './components/MaintenanceBanner.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #layout-top>
      <MaintenanceBanner />
    </template>
  </Layout>
</template>
