import { VoiceState } from '../Interface/Constants';
import { VoiceChannelOptions } from '../Interface/Player';
import { RainlinkConnection } from '../Player/RainlinkConnection';
import { RainlinkPlayer } from '../Player/RainlinkPlayer';
import { RainlinkManager } from './RainlinkManager';

export interface RainlinkPlayerManagerOptions {
  connections: Map<string, RainlinkConnection>;
  manager: RainlinkManager;
}

export class RainlinkPlayerManager extends Map<string, RainlinkPlayer> {
  private connections: Map<string, RainlinkConnection>;
  private manager: RainlinkManager;

  constructor(
    manager: RainlinkManager,
    connections: Map<string, RainlinkConnection>,
  ) {
    super();
    this.connections = connections;
    this.manager = manager;
  }

  async create(options: VoiceChannelOptions) {
    if (this.connections.has(options.guildId))
      throw new Error('This guild already have an existing connection');
    const connection = new RainlinkConnection(this.manager, options);
    this.connections.set(connection.guildId, connection);
    try {
      await connection.connect();
    } catch (error) {
      this.connections.delete(options.guildId);
      throw error;
    }
    try {
      const node = await this.manager.nodes.getLeastUsedNode();
      if (!node) throw new Error("Can't find any nodes to connect on");
      const player = new RainlinkPlayer(this.manager, options, node);
      const onUpdate = (state: VoiceState) => {
        if (state !== VoiceState.SESSION_READY) return;
        player.sendServerUpdate(connection);
      };
      await player.sendServerUpdate(connection);
      connection.on('connectionUpdate', onUpdate);
      this.set(player.guildId, player);
      return player;
    } catch (error) {
      connection.disconnect();
      this.connections.delete(options.guildId);
      throw error;
    }
  }

  /**
   * Leaves a voice channel
   * @param guildId The id of the guild you want to delete
   * @returns The destroyed / disconnected player or undefined if none
   * @internal
   */
  public async destroy(guildId: string = ''): Promise<void> {
    const player = this.get(guildId);
    if (player) player.destroy();
  }
}
