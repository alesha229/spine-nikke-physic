// animation-mix-controller.ts
import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

export interface AnimationConfig {
  track: number;
  name: string;
  loop: boolean;
  delay: number;
  weight?: number;
  timeScale?: number;
}

export interface AnimationMixConfig {
  animations: AnimationConfig[];
  crossFadeDuration: number;
}

export class AnimationMixController {
  private spine: Spine;
  private config: AnimationMixConfig;
  private nextPlayTimes: Map<number, number>;
  private currentTimes: Map<number, number>;
  private playedTracks: Set<number>;
  private trackStates: Map<
    number,
    { isPlaying: boolean; lastAnimation: string }
  >;
  private currentIdleName = "aim_idle";
  constructor(spine: Spine, config: AnimationMixConfig) {
    this.spine = spine;
    this.config = config;
    this.nextPlayTimes = new Map();
    this.currentTimes = new Map();
    this.playedTracks = new Set();
    this.trackStates = new Map();

    this.spine.state.data.defaultMix = this.config.crossFadeDuration;

    config.animations.forEach((anim) => {
      this.nextPlayTimes.set(anim.track, Date.now() + anim.delay);
      this.currentTimes.set(anim.track, 0);
      this.trackStates.set(anim.track, { isPlaying: false, lastAnimation: "" });
    });

    this.spine.state.addListener({
      complete: (entry) => {
        const track = entry.trackIndex;
        const state = this.trackStates.get(track);
        if (state) {
          state.isPlaying = false;
        }
      },
      start: () => {},
      interrupt: () => {},
      end: () => {},
      dispose: () => {},
      event: () => {},
    });
  }

  update(currentTime: number) {
    this.config.animations.forEach((anim) => {
      const track = anim.track;
      const trackState = this.trackStates.get(track);
      if (anim.loop) {
        if (!this.playedTracks.has(track)) {
          const trackEntry = this.spine.state.setAnimation(
            track,
            anim.name,
            anim.loop
          );

          if (anim.weight !== undefined) {
            trackEntry.alpha = anim.weight;
          }

          if (anim.timeScale !== undefined) {
            trackEntry.timeScale = anim.timeScale;
          }

          this.playedTracks.add(track);
          if (trackState) {
            trackState.isPlaying = true;
            trackState.lastAnimation = anim.name;
          }
        }
      } else {
        const shouldPlay = currentTime >= this.nextPlayTimes.get(track)!;
        const isTrackFree = !trackState?.isPlaying;

        if (shouldPlay && isTrackFree) {
          const trackEntry = this.spine.state.setAnimation(
            track,
            anim.name,
            anim.loop
          );

          if (anim.weight !== undefined) {
            trackEntry.alpha = anim.weight;
          }

          if (anim.timeScale !== undefined) {
            trackEntry.timeScale = anim.timeScale;
          }

          this.nextPlayTimes.set(track, currentTime + anim.delay);
          if (trackState) {
            trackState.isPlaying = true;
            trackState.lastAnimation = anim.name;
          }
        }
      }
    });
  }

  updateConfig(newConfig: Partial<AnimationMixConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.spine.state.data.defaultMix = this.config.crossFadeDuration;
  }

  updateAnimation(track: number, newSettings: Partial<AnimationConfig>) {
    const animationIndex = this.config.animations.findIndex(
      (a) => a.track === track
    );
    if (animationIndex !== -1) {
      this.config.animations[animationIndex] = {
        ...this.config.animations[animationIndex],
        ...newSettings,
      };
      this.applyAnimationChanges(track);
    }
  }

  applyAnimationChanges(track: number) {
    const animation = this.config.animations.find((a) => a.track === track);
    if (!animation) return;

    const trackEntry = this.spine.state.getCurrent(track);
    if (trackEntry) {
      if (trackEntry.animation?.name !== animation.name) {
        const newEntry = this.spine.state.setAnimation(
          track,
          animation.name,
          animation.loop
        );

        if (animation.weight !== undefined) {
          newEntry.alpha = animation.weight;
        }
        if (animation.timeScale !== undefined) {
          newEntry.timeScale = animation.timeScale;
        }
      } else {
        if (animation.weight !== undefined) {
          trackEntry.alpha = animation.weight;
        }
        if (animation.timeScale !== undefined) {
          trackEntry.timeScale = animation.timeScale;
        }
      }
    }
  }
}
