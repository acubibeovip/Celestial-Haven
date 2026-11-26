import { sessionErrorKeys, type ContentRegistry, type ValidationError } from '../application/ContentRegistry';
import type { GameSession, Mode, SessionState } from '../application/GameSession';
import type { ReadyView } from '../application/readyView';
import { confirmSelection, heroViewModels, initialSelection, reduceSelection, type HeroViewModel } from './selection';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = node('button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

function affinity(hero: HeroViewModel): HTMLSpanElement {
  const label = node('span', 'affinity', hero.element);
  const chip = node('span', 'affinity-chip');
  chip.style.setProperty('--element', hero.color);
  chip.setAttribute('aria-hidden', 'true');
  label.prepend(chip);
  return label;
}

function portrait(hero: HeroViewModel, placeholderLabel: string): HTMLSpanElement {
  // D10: no audited assets are bundled for the current roster.
  const image = node('span', 'portrait');
  image.style.setProperty('--element', hero.color);
  const initials = node('span', 'portrait-initials', hero.initials);
  initials.setAttribute('aria-hidden', 'true');
  image.append(initials, node('span', 'placeholder', placeholderLabel));
  return image;
}

export function showContentError(root: HTMLElement, title: string, errors: ValidationError[]): void {
  const screen = node('section', 'panel simple-screen');
  screen.setAttribute('role', 'alert');
  const list = node('ul', 'errors');
  for (const { file, path, code, message } of errors) {
    list.append(node('li', undefined, `${file}:${path} [${code}] ${message}`));
  }
  screen.append(node('h1', undefined, title), list);
  root.replaceChildren(screen);
}

type MenuOptions = {
  registry: ContentRegistry;
  session: GameSession;
  readyView: (state: Readonly<SessionState>) => ReadyView | null;
  initialReducedMotion: boolean;
};

export function mountMenu(root: HTMLElement, { registry, session, readyView, initialReducedMotion }: MenuOptions): void {
  const text = registry.text;
  const heroes = heroViewModels(registry);
  const placeholderLabel = text('ui.placeholder');
  const modeOptions: Mode[] = ['peaceful', 'adventure'];
  let reducedMotion = initialReducedMotion;
  let selection = initialSelection;
  let goBack: (() => void) | undefined;

  function setReducedMotion(value: boolean): void {
    reducedMotion = value;
    root.dataset.reducedMotion = String(value);
  }

  function show(screen: HTMLElement, focus?: HTMLElement, back?: () => void): void {
    goBack = back;
    root.replaceChildren(screen);
    window.scrollTo(0, 0);
    focus?.focus({ preventScroll: true });
  }

  function page(title: string, back: () => void, className: string) {
    const screen = node('section', className);
    const header = node('header', 'screen-header');
    const heading = node('h1', undefined, title);
    heading.tabIndex = -1;
    header.append(heading, button(text('ui.back'), 'button button-quiet', back));
    screen.append(header);
    return { screen, heading };
  }

  function title(returnTo?: 'new_game' | 'settings' | 'credits'): void {
    const screen = node('section', 'title-screen');
    const panel = node('div', 'title-panel panel');
    const crest = node('div', 'crest');
    crest.setAttribute('aria-hidden', 'true');
    const choices = node('div', 'title-actions');
    const options = {
      new_game: button(text('ui.title.new_game'), 'button button-primary', () => {
        selection = initialSelection;
        selectHero();
      }),
      settings: button(text('ui.title.settings'), 'button', settings),
      credits: button(text('ui.title.credits'), 'button', credits),
    };
    choices.append(...Object.values(options));
    panel.append(crest, node('h1', undefined, text('ui.project_name')), choices);
    screen.append(panel);
    show(screen, returnTo ? options[returnTo] : undefined);
  }

  function settings(): void {
    const back = () => title('settings');
    const { screen, heading } = page(text('ui.title.settings'), back, 'simple-screen panel');
    const control = button(text('ui.settings.reduced_motion'), 'setting-toggle', () => {
      setReducedMotion(!reducedMotion);
      control.setAttribute('aria-checked', String(reducedMotion));
    });
    control.setAttribute('role', 'switch');
    control.setAttribute('aria-checked', String(reducedMotion));
    const hint = node('p', 'muted', text('ui.settings.not_saved'));
    hint.id = 'settings-not-saved';
    control.setAttribute('aria-describedby', hint.id);
    screen.append(control, hint);
    show(screen, heading, back);
  }

  function credits(): void {
    const back = () => title('credits');
    const { screen, heading } = page(text('ui.title.credits'), back, 'simple-screen panel');
    screen.append(node('p', 'credit-name', text('ui.project_name')));
    show(screen, heading, back);
  }

  function ready(): void {
    const screen = node('section', 'simple-screen panel ready-screen');
    const heading = node('h1', undefined, text('ui.ready.title'));
    heading.tabIndex = -1;
    const view = readyView(session.snapshot());
    screen.append(heading, node('p', 'muted ready-note', text('ui.ready.temporary')));
    if (!view) {
      screen.append(node('p', 'menu-error', text('ui.ready.unavailable')));
      show(screen, heading);
      return;
    }

    const hero = node('h2', 'ready-hero', view.hero);
    const identity = node('dl', 'ready-details ready-identity');
    identity.append(
      node('dt', undefined, text('ui.ready.mode')), node('dd', undefined, view.mode),
      node('dt', undefined, text('ui.ready.level')), node('dd', undefined, String(view.level)),
    );

    const equipment = node('section', 'ready-group');
    const gear = node('ul');
    gear.append(...view.equipped.map((name) => node('li', undefined, name)));
    equipment.append(node('h2', undefined, text('ui.ready.equipment')), gear);

    const stats = node('section', 'ready-group');
    const details = node('dl', 'ready-details');
    const entries = [
      ['ui.ready.max_hp', view.stats.maxHp], ['ui.ready.max_mana', view.stats.maxMana],
      ['ui.ready.power', view.stats.power], ['ui.ready.guard', view.stats.guard],
    ] as const;
    for (const [key, value] of entries) {
      details.append(node('dt', undefined, text(key)), node('dd', undefined, String(value)));
    }
    stats.append(node('h2', undefined, text('ui.ready.stats')), details);

    const groups = node('div', 'ready-groups');
    groups.append(equipment, stats);
    screen.append(hero, identity, groups);
    show(screen, heading);
  }

  function selectHero(): void {
    const back = () => title('new_game');
    const { screen, heading } = page(text('ui.select.title'), back, 'selection-screen');
    const layout = node('div', 'selection-layout');
    const roster = node('div', 'roster');
    const preview = node('aside', 'hero-preview panel');
    preview.setAttribute('aria-label', text('ui.select.preview'));
    const form = node('form', 'selection-options panel');
    const modes = node('fieldset', 'modes');
    modes.append(node('legend', undefined, text('ui.select.mode')));

    const modeInputs = modeOptions.map((mode) => {
      const label = node('label', 'mode');
      const input = node('input');
      input.type = 'radio';
      input.name = 'mode';
      input.value = mode;
      input.checked = selection.mode === mode;
      const modeTitle = node('span', 'mode-title', text(`ui.mode.${mode}`));
      modeTitle.id = `mode-${mode}-label`;
      const description = node('span', 'mode-description', text(`ui.mode.${mode}_description`));
      description.id = `mode-${mode}-description`;
      input.setAttribute('aria-labelledby', modeTitle.id);
      input.setAttribute('aria-describedby', description.id);
      input.addEventListener('change', () => {
        selection = reduceSelection(selection, { type: 'mode', mode });
        updateConfirmation();
      });
      label.append(input, modeTitle, description);
      modes.append(label);
      return { mode, input };
    });

    const confirm = node('button', 'button button-primary', text('ui.select.confirm'));
    confirm.type = 'submit';
    const error = node('p', 'menu-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    form.append(modes, confirm, error);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const request = confirmSelection(selection);
      if (!request) return;
      const result = session.dispatch({ type: 'NewGame', ...request });
      if (!result.ok) {
        error.textContent = text(sessionErrorKeys[result.error]);
        error.hidden = false;
      }
    });

    const cards = heroes.map((hero, index) => {
      const card = button(hero.name, 'hero-card', () => {
        selection = reduceSelection(selection, { type: 'select', heroId: hero.id, index });
        updatePreview();
        updateConfirmation();
      });
      card.setAttribute('aria-label', hero.name);
      card.setAttribute('aria-description', [hero.archetype, hero.template, hero.element, placeholderLabel].join(' · '));
      card.replaceChildren(
        portrait(hero, placeholderLabel),
        node('span', 'hero-name', hero.name),
        node('span', 'hero-meta', `${hero.archetype} · ${hero.template}`),
        affinity(hero),
      );
      card.addEventListener('focus', () => {
        selection = reduceSelection(selection, { type: 'focus', index, count: heroes.length });
        updatePreview();
      });
      card.addEventListener('keydown', (event) => {
        const columns = getComputedStyle(roster).gridTemplateColumns.split(' ').length;
        const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
        const offset = offsets[event.key];
        if (offset === undefined) return;
        event.preventDefault();
        selection = reduceSelection(selection, { type: 'move', offset, count: heroes.length });
        cards[selection.focusedIndex]?.focus();
      });
      return card;
    });

    function updatePreview(): void {
      const hero = heroes[selection.focusedIndex];
      if (!hero) return;
      const detail = node('div', 'preview-detail');
      detail.append(
        node('h2', undefined, hero.name),
        node('p', 'hero-meta', `${hero.archetype} · ${hero.template}`),
        affinity(hero),
      );
      preview.replaceChildren(portrait(hero, placeholderLabel), detail);
    }

    function updateConfirmation(): void {
      error.hidden = true;
      cards.forEach((card, index) => card.setAttribute('aria-pressed', String(heroes[index]?.id === selection.heroId)));
      for (const { mode, input } of modeInputs) input.checked = mode === selection.mode;
      confirm.disabled = !confirmSelection(selection);
    }

    roster.append(...cards);
    layout.append(roster, preview);
    screen.append(layout, form);
    updatePreview();
    updateConfirmation();
    show(screen, heading, back);
  }

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && goBack) {
      event.preventDefault();
      goBack();
    }
  });
  session.subscribe((event) => {
    if (event.type === 'GameStarted') ready();
  });
  setReducedMotion(initialReducedMotion);
  title();
}
