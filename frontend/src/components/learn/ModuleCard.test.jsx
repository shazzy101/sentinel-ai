import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModuleCard from './ModuleCard'

const MOCK_MODULE = {
  id: 1,
  title: 'What are crypto whales?',
  description: 'Understand who the biggest players in crypto are.',
  unlocksFeature: 'whale_heatmap',
  screens: [],
}

describe('ModuleCard', () => {
  it('renders the module number', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    expect(screen.getByText(/module 1/i)).toBeInTheDocument()
  })

  it('renders the module title', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    expect(screen.getByText(MOCK_MODULE.title)).toBeInTheDocument()
  })

  it('renders the module description', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    expect(screen.getByText(MOCK_MODULE.description)).toBeInTheDocument()
  })

  it('shows "Start" button when not completed', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start module 1/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /review module 1/i })).not.toBeInTheDocument()
  })

  it('shows "Review" button when completed', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={true} onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /review module 1/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start module 1/i })).not.toBeInTheDocument()
  })

  it('shows a completed indicator (checkmark) when completed', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={true} onStart={vi.fn()} />)
    expect(screen.getByTestId('module-completed-indicator')).toBeInTheDocument()
  })

  it('does not show completed indicator when not completed', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    expect(screen.queryByTestId('module-completed-indicator')).not.toBeInTheDocument()
  })

  it('calls onStart with module id when Start is clicked', () => {
    const onStart = vi.fn()
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: /start module 1/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(MOCK_MODULE.id)
  })

  it('calls onStart with module id when Review is clicked', () => {
    const onStart = vi.fn()
    render(<ModuleCard module={MOCK_MODULE} completed={true} onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: /review module 1/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(MOCK_MODULE.id)
  })

  it('renders the unlocksFeature label', () => {
    render(<ModuleCard module={MOCK_MODULE} completed={false} onStart={vi.fn()} />)
    // underscores replaced with spaces
    expect(screen.getByText(/whale heatmap/i)).toBeInTheDocument()
  })
})
