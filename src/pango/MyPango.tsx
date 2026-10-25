import { useRepoQuery, useWornLook } from '../data/hooks';
import { MOMENT_KEY, momentOutfit, type Moment } from './moments';
import { Pango, type PangoProps } from './Pango';

/**
 * Pango wearing the look chosen in the wardrobe. A screen with an occasion passes `moment` (gym kit on Train), which
 * applies while "Dress for the moment" is on; an explicit `outfit` always wins.
 */
export function MyPango({ moment, ...props }: PangoProps & { moment?: Moment }) {
  const { outfit, ...parts } = useWornLook();
  const dress = useRepoQuery(['meta'], (r) => r.getMeta<boolean>(MOMENT_KEY), []);
  if (props.outfit) return <Pango {...props} />;
  const occasion = momentOutfit(moment, dress !== false, new Date());
  if (occasion) return <Pango {...props} outfit={occasion} />;
  return <Pango {...parts} outfit={outfit === 'custom' ? undefined : outfit} {...props} />;
}
