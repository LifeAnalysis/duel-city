import { proxy } from "valtio";

const openPrompts = new Set<string>();

export const presentationStore = proxy({
  promptCount: 0,
  watch: false,
});

export const setPresentationPrompt = (id: string, open: boolean) => {
  if (open) openPrompts.add(id);
  else openPrompts.delete(id);
  presentationStore.promptCount = openPrompts.size;
};

export const setWatchMode = (watch: boolean) => {
  presentationStore.watch = watch;
};
