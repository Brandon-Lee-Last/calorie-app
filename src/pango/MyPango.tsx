import { useWornLook } from '../data/hooks';
import { Pango, type PangoProps } from './Pango';

/** Pango wearing the look chosen in the wardrobe. A screen that asks for an outfit (say, gym on Train) gets that. */
export function MyPango(props: PangoProps) {
  const { outfit, ...parts } = useWornLook();
  if (props.outfit) return <Pango {...props} />;
  return <Pango {...parts} outfit={outfit === 'custom' ? undefined : outfit} {...props} />;
}
