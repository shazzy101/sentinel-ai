import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModulePlayer from './ModulePlayer'

// A minimal 3-screen test module
const MOCK_MODULE = {
  id: 1,
  title: 'What are crypto whales?',
  description: 'Test description',
  unlocksFeature: 'whale_heatmap',
  screens: [
    {
      title: 'Screen One',
      body: 'Body of screen one.',
    },
    {
      title: 'Screen Two',
      body: 'Body of screen two.',
      example: 'Example text here.',
    },
    {
      title: 'Screen Three',
      body: 'Body of screen three.',
    },
  ],
}

describe('ModulePlayer', () => {
  it('renders the first screen title on mount', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    expect(screen.getByText('Screen One')).toBeInTheDocument()
  })

  it('renders the first screen body on mount', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    expect(screen.getByText('Body of screen one.')).toBeInTheDocument()
  })

  it('shows "Next" button (not "Complete") on first screen', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /next screen/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete module/i })).not.toBeInTheDocument()
  })

  it('Back button is disabled on the first screen', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    const backBtn = screen.getByRole('button', { name: /previous screen/i })
    expect(backBtn).toBeDisabled()
  })

  it('clicking Next advances to the second screen', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    expect(screen.getByText('Screen Two')).toBeInTheDocument()
    expect(screen.queryByText('Screen One')).not.toBeInTheDocument()
  })

  it('renders the example block when a screen has one', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    expect(screen.getByText('Example text here.')).toBeInTheDocument()
  })

  it('ProgressBar reflects screen index', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    // After mount (screen 1): aria-valuenow should be 1
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '1')

    // After clicking Next (screen 2): should be 2
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    expect(bar).toHaveAttribute('aria-valuenow', '2')
  })

  it('ProgressBar shows total screens in aria-valuemax', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
  })

  it('clicking Back from screen 2 returns to screen 1', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    expect(screen.getByText('Screen Two')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /previous screen/i }))
    expect(screen.getByText('Screen One')).toBeInTheDocument()
  })

  it('shows Complete button on the last screen', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    expect(screen.getByRole('button', { name: /complete module/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next screen/i })).not.toBeInTheDocument()
  })

  it('clicking Complete calls onComplete with the module id', () => {
    const onComplete = vi.fn()
    render(<ModulePlayer module={MOCK_MODULE} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    fireEvent.click(screen.getByRole('button', { name: /complete module/i }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(MOCK_MODULE.id)
  })

  it('shows a completion screen after Complete is clicked', () => {
    render(<ModulePlayer module={MOCK_MODULE} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    fireEvent.click(screen.getByRole('button', { name: /next screen/i }))
    fireEvent.click(screen.getByRole('button', { name: /complete module/i }))
    expect(screen.getByText('Module complete')).toBeInTheDocument()
  })
})
