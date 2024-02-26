// Modded from: https://github.com/shipgirlproject/Shoukaku/blob/396aa531096eda327ade0f473f9807576e9ae9df/src/connectors/Connector.ts
// Special thanks to shipgirlproject team!

import { RainlinkNodeOptions } from '../Interface/Manager';
import { Rainlink } from '../Rainlink';
import { metadata } from '../manifest';
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
  protected node: RainlinkNodeOptions;
  /** @ignore */
  protected url: string;
  /** The node manager (RainlinkNode class) */
  public nodeManager: RainlinkNode;
  /** @ignore */
  protected sessionId: string | null;

  /**
   * The lavalink rest server handler class
   * @param manager The rainlink manager
   * @param node The rainlink node options, from RainlinkNodeOptions interface
   * @param nodeManager The rainlink's lavalink server handler class
   */
  constructor(manager: Rainlink, node: RainlinkNodeOptions, nodeManager: RainlinkNode) {
    this.manager = manager;
    this.axios = axios;
    this.node = node;
    this.nodeManager = nodeManager;
    this.sessionId = this.nodeManager.sessionId;
    this.url = `${node.secure ? 'https://' : 'http://'}${node.host}:${node.port}/v${metadata.lavalink}`;
  }

  /** @ignore */
  private async fetcher<D = any>(options: RainlinkFetcherOptions): Promise<D | undefined> {
    if (options.useSessionId && this.sessionId == null)
      throw new Error('sessionId not initalized! Please wait for lavalink get connected!');
    const url = new URL(`${this.url}${options.endpoint}`);
    if (options.params) url.search = new URLSearchParams(options.params).toString();

    const lavalinkHeaders = {
      Authorization: this.node.auth,
      ...options.requestOptions.headers,
    };

    options.requestOptions.headers = lavalinkHeaders;

    const res = await axios({
      url: url.toString(),
      ...options.requestOptions,
    });

    // const res = await undici.request(url, options.requestOptions typeof undici.Dispatcher.);
    if (res.status == 204) {
      this.debug('Player now destroyed');
      return undefined;
    }
    if (res.status !== 200) {
      this.debug('Something went wrong with lavalink server.' + `Status code: ${res.status}`);
      return undefined;
    }

    const finalData = String(res.data);

    return this.testJSON(finalData) ? (JSON.parse(res.data) as D) : (res.data as D);
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
    return (await this.fetcher<LavalinkPlayer[]>(options)) ?? [];
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
    return await this.fetcher<LavalinkPlayer>(options);
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
    return this.fetcher(options);
  }

  /** @ignore */
  private debug(logs: string) {
    this.manager.emit(RainlinkEvents.Debug, `[Rainlink Rest] ${logs}`);
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

    const resData = await this.fetcher<LavalinkResponse>(options);

    if (!resData) {
      return {
        loadType: LavalinkLoadType.EMPTY,
        data: {},
      };
    } else return resData;
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
