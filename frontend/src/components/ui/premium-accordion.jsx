import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { TextureCard, TextureCardContent } from '@/components/ui/texture-card';
import { cn } from '@/lib/utils';

export function PremiumAccordionItem({ question, answer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <TextureCard className="overflow-hidden">
      <TextureCardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-bg-elevated/50 transition-colors"
        >
          <span className="text-[14px] font-medium text-text-primary">{question}</span>
          <ChevronDown
            className={cn('h-4 w-4 text-text-muted flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-4 text-[13px] text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
                {answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </TextureCardContent>
    </TextureCard>
  );
}

export default function PremiumAccordion({ items }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <PremiumAccordionItem key={item.question} question={item.question} answer={item.answer} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
