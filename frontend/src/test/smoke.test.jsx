import { render, screen } from '@testing-library/react';

test('smoke: renders a div', () => {
  render(<div>ok</div>);
  expect(screen.getByText('ok')).toBeInTheDocument();
});
