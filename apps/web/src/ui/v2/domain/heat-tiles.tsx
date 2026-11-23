import { useContext } from 'react';
import { DrillOpenContext, type Drill } from '../drill.js';
import type { HeatLevel, HeatWords } from './heat-matrix.js';

/** One tile of a load map: a name, the figure, the lines under it, its step, and the rows it opens when it has any. */
export type HeatTileData = {
  id: string;
  name: string;
  value: string;
  unit: string;
  /** The running load, the second thing a tile says, a size below its figure; none for a map that has no running line. */
  running?: string;
  lines: string[];
  level: HeatLevel | null;
  /** The tile's one sentence for a screen reader and a hover. */
  summary: string;
  drill?: Drill;
};

function Tile({ tile }: { tile: HeatTileData }) {
  const open = useContext(DrillOpenContext);
  const body = (
    <>
      <span className="v2-heat-name">{tile.name}</span>
      <span className="v2-heat-value">
        {tile.value} <span className="v2-heat-line">{tile.unit}</span>
      </span>
      {tile.running ? <span className="v2-heat-run">{tile.running}</span> : null}
      {tile.lines.map((line) => (
        <span key={line} className="v2-heat-line">
          {line}
        </span>
      ))}
    </>
  );
  const common = {
    className: 'v2-heat-tile',
    'data-level': tile.level ?? undefined,
    'data-empty': tile.level === null ? '' : undefined,
    'data-tile': tile.id,
    title: tile.summary,
  };
  const { drill } = tile;
  return drill ? (
    <button
      type="button"
      {...common}
      aria-label={`${tile.summary}. ${drill.label}`}
      onClick={() => open(drill)}
    >
      {body}
    </button>
  ) : (
    <div {...common} role="group" aria-label={tile.summary}>
      {body}
    </div>
  );
}

/** The legend's numbers: what the lightest and the heaviest tile print, and the range each of the five steps covers. */
export type HeatScale = { low: string; high: string; steps: string[] };

/**
 * A map of tiles tinted by weight (the plant's load by cell, by location): each prints its figure and what stands
 * behind it, so the tint is never the only sign. A tile with machines behind it is a button that opens them.
 */
export function HeatTiles({
  title,
  tiles,
  words,
  scale,
}: {
  title: string;
  tiles: HeatTileData[];
  words: HeatWords;
  /** Numbers for the legend's ends and steps; without it the ends say only lighter and heavier. */
  scale?: HeatScale;
}) {
  return (
    <div>
      <ul className="v2-heat-tiles" aria-label={title}>
        {tiles.map((tile) => (
          <li key={tile.id}>
            <Tile tile={tile} />
          </li>
        ))}
      </ul>
      <div className="v2-heat-legend" aria-hidden="true">
        <span>{scale?.low ?? words.low}</span>
        {([1, 2, 3, 4, 5] as const).map((level) => (
          <span
            key={level}
            className="v2-heat-step"
            data-level={level}
            title={scale?.steps[level - 1]}
          />
        ))}
        <span>{scale?.high ?? words.high}</span>
      </div>
    </div>
  );
}
