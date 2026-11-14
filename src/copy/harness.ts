// Synthetic browser proof. Production copy code is shared with the real panel.
import { copyFixture, copyOptions } from '../../tests/copy-fixture';
import { copyArrangement } from './index';
import { generate } from '../generate';

const { doc, song, files } = await copyFixture();
const proof = {
  files: [...files].map(([path, bytes]) => ({ path, bytes: [...bytes] })),
  source: generate(doc),
  programs: ['silence', 'literal', 'simplified'].map((mode) => {
    if (mode !== 'silence' && mode !== 'literal' && mode !== 'simplified')
      throw Error('fixture mode');
    return {
      mode,
      ...copyArrangement({ doc, song, options: { ...copyOptions, unarranged: mode } }),
    };
  }),
};
declare global {
  interface Window {
    copyProof: typeof proof;
  }
}
window.copyProof = proof;
