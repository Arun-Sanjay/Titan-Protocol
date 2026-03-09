declare module "howler" {
  export type HowlOptions = {
    src: string[];
    volume?: number;
    rate?: number;
    loop?: boolean;
    preload?: boolean;
  };

  export class Howl {
    constructor(options: HowlOptions);
    play(spriteOrId?: string | number): number;
    stop(id?: number): this;
    unload(): void;
    volume(volume?: number, id?: number): number | this;
    rate(rate?: number, id?: number): number | this;
  }
}
