<script setup>
import { confirmState, answerConfirm } from "../../composables/useConfirm.js";
import ConfirmDialog from "./ConfirmDialog.vue";
</script>

<template>
  <ConfirmDialog
    :open="!!confirmState"
    :title="confirmState?.title"
    :body="confirmState?.body"
    :confirm-label="confirmState?.confirmLabel"
    :cancel-label="confirmState?.cancelLabel"
    :danger="confirmState?.danger"
    @close="answerConfirm(false)"
    @confirm="answerConfirm(true)"
  />
</template>
