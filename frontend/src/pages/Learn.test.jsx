import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock useLearnProgress — controlled per-test
vi.mock('@/hooks/useLearnProgress', () => ({
  useLearnProgress: vi.fn(),
}))

import { useLearnProgress } from '@/hooks/useLearnProgress'
import Learn from './Learn'

function renderLearn() {
  return render(
    <MemoryRouter>
      <Learn />
    </MemoryRouter>,
  )
}

function makeProgress({ completed = [], unlocked = [] } = {}) {
  return {
    completed,
    unlocked,
    complete: vi.fn(),
    isCompleted: (id) => completed.includes(id),
    isUnlocked: (key) => unlocked.includes(key),
    loading: false,
  }
}

describe('Learn page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 6 module cards', () => {
    useLearnProgress.mockReturnValue(makeProgress())
    renderLearn()
    // Each ModuleCard has a data-testid="module-card-N"
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByTestId(`module-card-${i}`)).toBeInTheDocument()
    }
  })

  it('shows overall progress count when 0 completed', () => {
    useLearnProgress.mockReturnValue(makeProgress())
    renderLearn()
    expect(screen.getByTestId('progress-count')).toHaveTextContent('0 / 6 modules complete')
  })

  it('shows updated progress count when 2 modules are completed', () => {
    useLearnProgress.mockReturnValue(makeProgress({ completed: [1, 2] }))
    renderLearn()
    expect(screen.getByTestId('progress-count')).toHaveTextContent('2 / 6 modules complete')
  })

  it('shows completed indicators for completed modules', () => {
    useLearnProgress.mockReturnValue(makeProgress({ completed: [1, 3] }))
    renderLearn()
    // Two completed indicators should be visible (modules 1 and 3)
    const indicators = screen.getAllByTestId('module-completed-indicator')
    expect(indicators).toHaveLength(2)
  })

  it('shows no completed indicators when no modules are done', () => {
    useLearnProgress.mockReturnValue(makeProgress())
    renderLearn()
    expect(screen.queryAllByTestId('module-completed-indicator')).toHaveLength(0)
  })

  it('shows loading skeletons when loading=true', () => {
    useLearnProgress.mockReturnValue({
      ...makeProgress(),
      loading: true,
    })
    renderLearn()
    // Module cards should not be rendered while loading
    expect(screen.queryByTestId('module-card-1')).not.toBeInTheDocument()
  })

  it('renders the page header', () => {
    useLearnProgress.mockReturnValue(makeProgress())
    renderLearn()
    expect(screen.getByText(/learn & unlock/i)).toBeInTheDocument()
  })

  it('renders all 6 module titles', () => {
    useLearnProgress.mockReturnValue(makeProgress())
    renderLearn()
    expect(screen.getByText('What are crypto whales?')).toBeInTheDocument()
    expect(screen.getByText('Why whale movements predict price')).toBeInTheDocument()
    expect(screen.getByText('Reading on-chain data')).toBeInTheDocument()
    expect(screen.getByText('How to act on a signal safely')).toBeInTheDocument()
    expect(screen.getByText('Risk management basics')).toBeInTheDocument()
    expect(screen.getByText('Understanding confidence scores')).toBeInTheDocument()
  })
})
