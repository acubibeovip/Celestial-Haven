import type { ContentRegistry } from '../application/ContentRegistry';

export function mountWorldPanel(host: HTMLElement, text: ContentRegistry['text'], interact: () => void) {
  const layout = document.createElement('div');
  layout.className = 'world-panel';
  const hud = document.createElement('div');
  hud.className = 'world-hud';

  function status(testId: string): HTMLParagraphElement {
    const row = document.createElement('p');
    row.dataset.testid = testId;
    return row;
  }

  const mapName = status('map-name');
  const day = status('world-day');
  const xp = status('world-xp');
  mapName.setAttribute('role', 'status');
  hud.append(mapName, day, xp);

  const prompt = status('interaction-prompt');
  prompt.className = 'world-prompt';
  prompt.hidden = true;

  function button(key: string): HTMLButtonElement {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'button';
    control.textContent = text(key);
    return control;
  }

  const action = button('ui.world.interact');
  action.classList.add('world-interact');
  action.hidden = true;
  action.addEventListener('click', interact);

  const toast = status('world-toast');
  toast.className = 'world-toast';
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  let timeout: number | undefined;

  const dialog = document.createElement('dialog');
  dialog.className = 'world-sleep';
  const title = document.createElement('h2');
  title.id = 'sleep-dialog-label';
  title.textContent = text('ui.world.sleep_question');
  dialog.setAttribute('aria-labelledby', title.id);
  const yes = button('ui.world.yes');
  const no = button('ui.world.no');
  no.autofocus = true;
  dialog.append(title, yes, no);
  let sleep: (() => void) | undefined;
  let restoreFocus: HTMLElement | undefined;

  function closeDialog(): void {
    dialog.close();
    if (restoreFocus?.isConnected && !restoreFocus.hidden) restoreFocus.focus();
    else host.focus();
    restoreFocus = undefined;
    sleep = undefined;
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    (document.activeElement === yes ? no : yes).focus();
  });
  no.addEventListener('click', closeDialog);
  yes.addEventListener('click', () => {
    const confirm = sleep;
    closeDialog();
    confirm?.();
  });
  layout.append(hud, prompt, action, toast, dialog);
  host.append(layout);

  return {
    mapName,
    day,
    xp,
    isDialogOpen: () => dialog.open,
    showPrompt(message: string | undefined, x = 0, y = 0): void {
      if (prompt.textContent !== (message ?? '')) prompt.textContent = message ?? '';
      prompt.hidden = message === undefined;
      action.hidden = prompt.hidden;
      if (message === undefined) {
        if (document.activeElement === action) host.focus();
        return;
      }
      const halfWidth = prompt.offsetWidth / 2;
      prompt.style.left = `${Math.max(halfWidth + 4, Math.min(host.clientWidth - halfWidth - 4, x))}px`;
      prompt.style.top = `${Math.max(prompt.offsetHeight + 4, y)}px`;
    },
    announce(message: string): void {
      window.clearTimeout(timeout);
      toast.textContent = message;
      timeout = window.setTimeout(() => { toast.textContent = ''; }, 6000);
    },
    confirmSleep(onConfirm: () => void): void {
      if (dialog.open) return;
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      sleep = onConfirm;
      dialog.showModal();
      no.focus();
    },
    destroy(): void {
      window.clearTimeout(timeout);
      if (dialog.open) dialog.close();
      layout.remove();
    },
  };
}
