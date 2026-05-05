/** Program ids — names live in locales (`dungeons.<id>.*`). */
export type DungeonId = 'volume' | 'spire' | 'labyrinth' | 'ruins';

export type DungeonDef = {
  id: DungeonId;
  floors: number;
};

export const DUNGEONS: DungeonDef[] = [
  { id: 'volume', floors: 8 },
  { id: 'spire', floors: 6 },
  { id: 'labyrinth', floors: 5 },
  { id: 'ruins', floors: 5 },
];
