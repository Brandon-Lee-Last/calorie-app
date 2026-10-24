import { render } from '@testing-library/react-native';

import { Pango } from '../src/pango/Pango';
import { OUTFITS, POSES } from '../src/pango/types';

describe('<Pango />', () => {
  it('renders every pose with an accessible label', async () => {
    for (const pose of POSES) {
      const view = await render(<Pango pose={pose} size={120} />);
      expect(view.getByLabelText(/^Pango the pangolin/)).toBeTruthy();
      await view.unmount();
    }
  });

  it('renders every outfit, full and as a face', async () => {
    for (const outfit of OUTFITS) {
      for (const crop of ['full', 'face'] as const) {
        const view = await render(<Pango outfit={outfit} crop={crop} size={80} motion={false} />);
        await view.unmount();
      }
    }
  });

  it('sizes itself from the frame', async () => {
    const view = await render(<Pango size={100} crop="face" />);
    const style = [view.getByLabelText(/^Pango/).props.style].flat();
    expect(style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 128, height: 100 })]));
    await view.unmount();
  });
});
