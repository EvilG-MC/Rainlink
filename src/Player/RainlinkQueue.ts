import { RainlinkEvents } from '../Interface/Constants';
import { Rainlink } from '../Rainlink';
import { RainlinkPlayer } from './RainlinkPlayer';
import { RainlinkTrack } from './RainlinkTrack';

export class RainlinkQueue extends Array<RainlinkTrack> {
  /** Rainlink manager */
  manager: Rainlink;
  /** Rainlink player */
  player: RainlinkPlayer;

  constructor(manager: Rainlink, player: RainlinkPlayer) {
    super();
    this.manager = manager;
    this.player = player;
  }

  /** Get the size of queue */
  public get size() {
    return this.length;
  }

  /** Get the size of queue including current */
  public get totalSize(): number {
    return this.length + (this.current ? 1 : 0);
  }

  /** Check if the queue is empty or not */
  public get isEmpty() {
    return this.length === 0;
  }

  /** Get the queue's duration */
  public get duration() {
    return this.reduce((acc, cur) => acc + (cur.duration || 0), 0);
  }

  /** Current playing track */
  public current: RainlinkTrack | undefined | null = null;
  /** Previous playing tracks */
  public previous: RainlinkTrack[] = [];

  /**
   * Add track(s) to the queue
   * @param track KazagumoTrack to add
   * @returns RainlinkQueue
   */
  public add(track: RainlinkTrack | RainlinkTrack[]): RainlinkQueue {
    if (Array.isArray(track) && track.some(t => !(t instanceof RainlinkTrack)))
      throw new Error('Track must be an instance of RainlinkTrack');
    if (!Array.isArray(track) && !(track instanceof RainlinkTrack)) track = [track];

    if (!this.current) {
      if (Array.isArray(track)) this.current = track.shift();
      else {
        this.current = track;
        return this;
      }
    }

    if (Array.isArray(track)) for (const t of track) this.push(t);
    else this.push(track);
    this.emitChanges();
    return this;
  }

  /**
   * Remove track from the queue
   * @param position Position of the track
   * @returns RainlinkQueue
   */
  public remove(position: number): RainlinkQueue {
    if (position < 0 || position >= this.length)
      throw new Error('Position must be between 0 and ' + (this.length - 1));
    this.splice(position, 1);
    this.emitChanges();
    return this;
  }

  /** Shuffle the queue */
  public shuffle(): RainlinkQueue {
    for (let i = this.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this[i], this[j]] = [this[j], this[i]];
    }
    this.emitChanges();
    return this;
  }

  /** Clear the queue */
  public clear(): RainlinkQueue {
    this.splice(0, this.length);
    this.emitChanges();
    return this;
  }

  private emitChanges(): void {
    this.manager.emit(RainlinkEvents.QueueUpdate, this.player, this);
  }
}
