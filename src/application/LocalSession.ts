import { equip, unequip } from '@domain/equipment/equipment';
import { harvest } from '@domain/gathering/harvest';
import { getEntry } from '@domain/player/catalog';
import { assignHotbar, moveSlot } from '@domain/inventory/layout';
import { createNewGame } from '@domain/player/newGame';
import type { NewGameCatalog, PlayerState } from '@domain/player/types';
import { START_MAP_ID, type MapCatalog } from './MapCatalog';
import { err, ok, type Result } from '@shared/result';
import type { GameSession, SessionCommand, SessionError, SessionEvent, SessionListener, SessionState } from './GameSession';

function freezeTree<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export class LocalSession implements GameSession {
  private state: Readonly<SessionState> = Object.freeze({ phase: 'menu' });
  private readonly listeners = new Set<SessionListener>();

  private readonly catalog: NewGameCatalog;
  private readonly maps: MapCatalog;
  private readonly reportError: (error: unknown) => void;

  constructor(catalog: NewGameCatalog, maps: MapCatalog, reportError: (error: unknown) => void = (error) => console.error(error)) {
    this.catalog = catalog;
    this.maps = maps;
    this.reportError = reportError;
  }

  snapshot(): Readonly<SessionState> {
    return this.state;
  }

  subscribe(listener: SessionListener): () => void {
    const subscription: SessionListener = (event) => listener(event);
    this.listeners.add(subscription);
    return () => { this.listeners.delete(subscription); };
  }

  dispatch(command: SessionCommand): Result<void, SessionError> {
    switch (command.type) {
      case 'NewGame': {
        if (this.state.phase === 'playing') return err('ALREADY_PLAYING');
        const spawn = this.maps.get(START_MAP_ID)?.spawns.get('default');
        if (!spawn) return err('MISSING_CHECKPOINT');
        const result = createNewGame(command, this.catalog, spawn);
        if (!result.ok) return result;
        this.state = freezeTree({ phase: 'playing', player: result.value, world: { day: 1, resourceNodes: {} } });
        this.emit(Object.freeze({ type: 'GameStarted', heroId: result.value.heroId, mode: result.value.mode }));
        return ok(undefined);
      }
      case 'EnterExit': {
        if (this.state.phase !== 'playing') return err('NOT_PLAYING');
        const { player } = this.state;
        const exit = this.maps.get(player.location.mapId)?.exits.get(command.exitName);
        if (!exit) return err('UNKNOWN_EXIT');
        const spawn = this.maps.get(exit.targetMap)?.spawns.get(exit.targetSpawn);
        if (!spawn) return err('MISSING_CHECKPOINT');
        this.state = freezeTree({ ...this.state, player: { ...player, location: { ...spawn } } });
        this.emit(Object.freeze({ type: 'MapChanged', mapId: spawn.mapId }));
        return ok(undefined);
      }
      case 'Equip':
        return this.changeInventory('EquipmentChanged', (player) => equip(player, command.gearId, this.catalog));
      case 'Unequip':
        return this.changeInventory('EquipmentChanged', (player) => unequip(player, command.slot));
      case 'MoveBagSlot':
        return this.changeInventory('InventoryChanged', (player) => moveSlot(player, command.from, command.to, this.catalog));
      case 'AssignHotbar':
        return this.changeInventory('InventoryChanged', (player) => assignHotbar(player, command.index, command.itemId, this.catalog));
      case 'Gather': {
        if (this.state.phase !== 'playing') return err('NOT_PLAYING');
        const { player, world } = this.state;
        const node = getEntry(this.catalog.resourceNodes, command.nodeId);
        if (!node) return err('UNKNOWN_NODE');
        if (!this.maps.get(player.location.mapId)?.resourceNodeIds.has(node.id)) return err('NODE_NOT_ON_MAP');

        const result = harvest(player, world, node, this.catalog);
        if (!result.ok) return result;
        const { player: nextPlayer, world: nextWorld, xp, levelsGained } = result.value;
        this.state = freezeTree({ phase: 'playing', player: nextPlayer, world: nextWorld });
        this.emit(Object.freeze({
          type: 'ResourceGathered', nodeId: node.id, itemId: node.itemId, quantity: node.quantity, xp, levelsGained,
        }));
        return ok(undefined);
      }
      case 'EndDay': {
        if (this.state.phase !== 'playing') return err('NOT_PLAYING');
        const world = { ...this.state.world, day: this.state.world.day + 1 };
        this.state = freezeTree({ ...this.state, world });
        this.emit(Object.freeze({ type: 'DayEnded', day: world.day }));
        return ok(undefined);
      }
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  }

  private changeInventory(
    type: 'EquipmentChanged' | 'InventoryChanged',
    change: (player: Readonly<PlayerState>) => Result<PlayerState, SessionError>,
  ): Result<void, SessionError> {
    if (this.state.phase !== 'playing') return err('NOT_PLAYING');
    const { player } = this.state;
    const result = change(player);
    if (!result.ok) return result;
    if (result.value === player) return ok(undefined);
    this.state = freezeTree({ ...this.state, player: result.value });
    this.emit(Object.freeze({ type }));
    return ok(undefined);
  }

  private emit(event: SessionEvent): void {
    // Snapshot the order. Skip removed listeners and defer new subscriptions.
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try {
        listener(event);
      } catch (error) {
        try {
          this.reportError(error);
        } catch {
          // A faulty reporter must not interrupt other listeners or dispatch.
        }
      }
    }
  }
}
