import * as THREE from 'three';

/**
 * TimelineManager
 * 
 * Manages global time, playback, and animation speed.
 * Acts as the central clock for the application.
 */
export class TimelineManager {
  // Time state
  public time: number = 0;
  public delta: number = 0;
  public frame: number = 0;
  
  // Playback control
  public isPlaying: boolean = true;
  public speed: number = 1.0;
  
  // Internal tracking
  private lastTimestamp: number = 0;
  
  constructor() {
    this.reset();
  }
  
  /**
   * Update time based on browser timestamp
   * Should be called once per frame in the main loop
   */
  update(timestamp: number): void {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return;
    }
    
    // Calculate raw delta (in seconds)
    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    
    // Apply playback controls
    if (this.isPlaying) {
      this.delta = rawDelta * this.speed;
      this.time += this.delta;
      this.frame++;
    } else {
      this.delta = 0;
    }
  }
  
  /**
   * Play animation
   */
  play(): void {
    this.isPlaying = true;
  }
  
  /**
   * Pause animation
   */
  pause(): void {
    this.isPlaying = false;
    this.delta = 0;
  }
  
  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
  
  /**
   * Stop animation and reset to zero
   */
  stop(): void {
    this.pause();
    this.reset();
  }
  
  /**
   * Reset time to zero
   */
  reset(): void {
    this.time = 0;
    this.delta = 0;
    this.frame = 0;
    // We don't reset isPlaying or speed here usually
  }
  
  /**
   * Set specific time (scrubbing)
   */
  setTime(time: number): void {
    this.time = time;
  }
  
  /**
   * Set playback speed
   * 1.0 = normal, 0.5 = half speed, 2.0 = double speed
   * Negative values play in reverse
   */
  setSpeed(speed: number): void {
    this.speed = speed;
  }
  
  /**
   * Dispose resources (if any)
   */
  dispose(): void {
    // Nothing to dispose currently
  }
}
