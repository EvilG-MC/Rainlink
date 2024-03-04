// Modded from: https://github.com/shipgirlproject/Shoukaku/blob/396aa531096eda327ade0f473f9807576e9ae9df/src/connectors/Connector.ts
// Special thanks to shipgirlproject team!

import { RainlinkNodeOptions } from '../Interface/Manager';
import { Rainlink } from '../Rainlink';
import { metadata } from '../metadata';
import { LavalinkLoadType, RainlinkEvents } from '../Interface/Constants';
import { RainlinkNode } from './RainlinkNode';
import {
  LavalinkPlayer,
  LavalinkResponse,
  RainlinkFetcherOptions,
  UpdatePlayerInfo,
} from '../Interface/Rest';
import axios from 'axios';

export class RainlinkRest {
  /** @ignore */
  protected axios: typeof axios;
  /** The rainlink manager */
  public manager: Rainlink;
  /** @ignore */
  protected options: RainlinkNodeOptions;
  /** @ignore */
  protected url: string;
  /** The node manager (RainlinkNode class) */
  public nodeManager: RainlinkNode;
  /** @ignore */
  protected sessionId: string | null;

  /**
   * The lavalink rest server handler class
   * @param manager The rainlink manager
   * @param options The rainlink node options, from RainlinkNodeOptions interface
   * @param nodeManager The rainlink's lavalink server handler class
   */
  constructor(manager: Rainlink, options: RainlinkNodeOptions, nodeManager: RainlinkNode) {
    this.manager = manager;
    this.axios = axios;
    this.options = options;
    this.nodeManager = nodeManager;
    this.sessionId = this.nodeManager.driver.sessionId ? this.nodeManager.driver.sessionId : '';
    this.url = `${options.secure ? 'https://' : 'http://'}${options.host}:${options.port}/v${metadata.lavalink}`;
  }

  /**
   * Gets all the player with the specified sessionId
   * @returns Promise that resolves to an array of Lavalink players
   */
  public async getPlayers(): Promise<LavalinkPlayer[]> {
    const options: RainlinkFetcherOptions = {
      endpoint: `/sessions/${this.sessionId}/players`,
      params: undefined,
      useSessionId: true,
      requestOptions: {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      },
    };
    return (await this.nodeManager.driver.fetcher<LavalinkPlayer[]>(options)) ?? [];
  }

  /**
   * Updates a Lavalink player
   * @returns Promise that resolves to a Lavalink player
   */
  public async updatePlayer(data: UpdatePlayerInfo): Promise<LavalinkPlayer | undefined> {
    const options: RainlinkFetcherOptions = {
      endpoint: `/sessions/${this.sessionId}/players/${data.guildId}`,
      params: { noReplace: data.noReplace?.toString() || 'false' },
      useSessionId: true,
      requestOptions: {
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
        data: data.playerOptions as Record<string, unknown>,
      },
    };
    return await this.nodeManager.driver.fetcher<LavalinkPlayer>(options);
  }

  /**
   * Destroy a Lavalink player
   * @returns Promise that resolves to a Lavalink player
   */
  public destroyPlayer(guildId: string) {
    const options: RainlinkFetcherOptions = {
      endpoint: `/sessions/${this.sessionId}/players/${guildId}`,
      params: undefined,
      useSessionId: true,
      requestOptions: {
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      },
    };
    return this.nodeManager.driver.fetcher(options);
  }

  /** @ignore */
  private debug(logs: string) {
    this.manager.emit(RainlinkEvents.Debug, `[Rainlink Rest]: ${logs}`);
  }

  /**
   * A track resolver function to get track from lavalink
   * @returns LavalinkResponse
   */
  public async resolver(data: string): Promise<LavalinkResponse> {
    const options: RainlinkFetcherOptions = {
      endpoint: `/loadtracks`,
      params: { identifier: data },
      requestOptions: {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      },
    };

    const resData = await this.nodeManager.driver.fetcher<LavalinkResponse>(options);

    if (!resData) {
      return {
        loadType: LavalinkLoadType.EMPTY,
        data: {},
      };
    } else return resData;
  }

  /**
   * Update a season to resume able or not
   * @returns LavalinkResponse
   */
  public async updateSession(sessionId: string, mode: boolean, timeout: number): Promise<void> {
    const options: RainlinkFetcherOptions = {
      endpoint: `/sessions/${sessionId}`,
      requestOptions: {
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
        data: {
          resuming: mode,
          timeout: timeout,
        },
      },
    };

    await this.nodeManager.driver.fetcher<{ resuming: boolean; timeout: number }>(options);
    this.debug(`Session updated! resume: ${mode}, timeout: ${timeout}`);
    return;
  }

  /** @ignore */
  protected testJSON(text: string) {
    if (typeof text !== 'string') {
      return false;
    }
    try {
      JSON.parse(text);
      return true;
    } catch (error) {
      return false;
    }
  }
}
