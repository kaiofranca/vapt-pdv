import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Polyfill básico para window.print se necessário
if (!window.print) {
  window.print = () => {};
}
