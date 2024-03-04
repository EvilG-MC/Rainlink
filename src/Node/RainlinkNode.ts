import { RawData, WebSocket } from 'ws';
import { RainlinkNodeOptions } from '../Interface/Manager';
import { Rainlink } from '../Rainlink';
import { RainlinkConnectState, RainlinkEvents, RainlinkServer } from '../Interface/Constants';
import { RainlinkRest } from './RainlinkRest';
import { metadata } from '../metadata';
import { setTimeout } from 'node:timers/promises';
import { RainlinkWebsocket } from './RainlinkWebsocket';
import { LavalinkEventsEnum } from '../Interface/LavalinkEvents';
import { LavalinkNodeStatsResponse, NodeStats } from '../Interface/Node';
import { RainlinkPlugin as SaveSessionPlugin } from '../Plugin/SaveSession/Plugin';
import { AbstractDriver } from '../Drivers/AbstractDriver';
import { Lavalink4 } from '../Drivers/Lavalink4';

export class RainlinkNode {
  /** The rainlink manager */
  public manager: Rainlink;
  /** The rainlink node options */
  public options: RainlinkNodeOptions;
  /** The rainlink rest manager */
  public rest: RainlinkRest;
  /** The lavalink server season id to resume */
  public sessionId: string | null;
  /** The lavalink server online status */
  public online: boolean = false;
  /** @ignore */
  private retryCounter = 0;
  /** The lavalink server connect state */
  public state: RainlinkConnectState = RainlinkConnectState.Closed;
  /** The lavalink server all status */
  public stats: NodeStats;
  /** @ignore */
  private sudoDisconnect = false;
  /** @ignore */
  private wsEvent: RainlinkWebsocket;
  /** @ignore */
  private sessionPlugin?: SaveSessionPlugin | null;
  /** @ignore */
  public driver: AbstractDriver;

  /**
   * The lavalink server handler class
   * @param manager The rainlink manager
   * @param options The lavalink server options
   */
  constructor(manager: Rainlink, options: RainlinkNodeOptions) {
    this.manager = manager;
    this.options = options;
    const customRest = this.manager.rainlinkOptions.options!.structures!.rest;
    this.rest = customRest
      ? new customRest(manager, options, this)
      : new RainlinkRest(manager, options, this);
    this.sessionId = null;
    this.wsEvent = new RainlinkWebsocket();
    if (this.manager.rainlinkOptions.driver == RainlinkServer.Lavalink4) {
      this.driver = new Lavalink4(this.manager, options, this);
    } else {
      throw new Error('Please include a valid server driver enum');
    }
    this.stats = {
      players: 0,
      playingPlayers: 0,
      uptime: 0,
      memory: {
        free: 0,
        used: 0,
        allocated: 0,
        reservable: 0,
      },
      cpu: {
        cores: 0,
        systemLoad: 0,
        lavalinkLoad: 0,
      },
      frameStats: {
        sent: 0,
        nulled: 0,
        deficit: 0,
      },
    };
  }

  /** Connect this lavalink server */
  public connect(): WebSocket {
    return this.driver.connect();
  }

  /** @ignore */
  public wsOpenEvent() {
    this.clean(true);
    this.state = RainlinkConnectState.Connected;
    this.debug(`Node ${this.options.name} connected! URL: ${this.driver.wsUrl}`);
    this.manager.emit(RainlinkEvents.NodeConnect, this);
  }

  /** @ignore */
  public wsMessageEvent(data: Record<string, any>) {
    switch (data.op) {
      case LavalinkEventsEnum.Ready: {
        const isResume = this.manager.rainlinkOptions.options!.resume!;
        const timeout = this.manager.rainlinkOptions.options?.resumeTimeout!;
        this.sessionId = data.sessionId;
        this.rest = new RainlinkRest(this.manager, this.options, this);
        if (isResume) {
          this.rest.updateSession(data.sessionId, isResume, timeout);
          if (this.sessionPlugin) {
            this.sessionPlugin.deleteSession(this.options.host);
            this.sessionPlugin.setSession(this.options.host, data.sessionId);
          }
        }
        break;
      }
      case LavalinkEventsEnum.Event: {
        this.wsEvent.initial(data, this.manager);
        break;
      }
      case LavalinkEventsEnum.PlayerUpdate: {
        this.wsEvent.initial(data, this.manager);
        break;
      }
      case LavalinkEventsEnum.Status: {
        this.stats = this.updateStatusData(data as LavalinkNodeStatsResponse);
        break;
      }
    }
  }

  /** @ignore */
  public wsErrorEvent(logs: Error) {
    this.debug(`Node ${this.options.name} errored! URL: ${this.driver.wsUrl}`);
    this.manager.emit(RainlinkEvents.NodeError, this, logs);
  }

  /** @ignore */
  public async wsCloseEvent(code: number, reason: Buffer) {
    this.online = false;
    this.state = RainlinkConnectState.Disconnected;
    this.debug(`Node ${this.options.name} disconnected! URL: ${this.driver.wsUrl}`);
    this.manager.emit(RainlinkEvents.NodeDisconnect, this, code, reason);
    if (!this.sudoDisconnect && this.retryCounter !== this.manager.rainlinkOptions.options!.retryCount) {
      await setTimeout(this.manager.rainlinkOptions.options!.retryTimeout);
      this.retryCounter = this.retryCounter + 1;
      this.reconnect();
      return;
    }
    this.nodeClosed();
    return;
  }

  /** @ignore */
  protected nodeClosed() {
    this.manager.emit(RainlinkEvents.NodeClosed, this);
    this.debug(`Node ${this.options.name} closed! URL: ${this.driver.wsUrl}`);
    this.clean();
  }

  /** @ignore */
  protected updateStatusData(data: LavalinkNodeStatsResponse): NodeStats {
    return {
      players: data.players ?? this.stats.players,
      playingPlayers: data.playingPlayers ?? this.stats.playingPlayers,
      uptime: data.uptime ?? this.stats.uptime,
      memory: data.memory ?? this.stats.memory,
      cpu: data.cpu ?? this.stats.cpu,
      frameStats: data.frameStats ?? this.stats.frameStats,
    };
  }

  /** Disconnect this lavalink server */
  public disconnect() {
    this.sudoDisconnect = true;
    this.driver.wsClose();
  }

  /** Reconnect back to this lavalink server */
  public reconnect() {
    this.clean();
    this.driver.connect();
  }

  /** Clean all the lavalink server state and set to default value */
  public clean(online: boolean = false) {
    this.sudoDisconnect = false;
    this.retryCounter = 0;
    this.online = online;
    this.state = RainlinkConnectState.Closed;
  }

  /** @ignore */
  private debug(logs: string) {
    this.manager.emit(RainlinkEvents.Debug, `[Rainlink Node]: ${logs}`);
  }
}
