import { useEffect } from 'react';
import {
  DynamicContainer,
  DynamicIsland,
  DynamicIslandProvider,
  DynamicTitle,
  SIZE_PRESETS,
  useDynamicIslandSize,
} from '@/components/ui/dynamic-island';
import { cn } from '@/lib/utils';

function ScanIslandInner({ message, address, visible }) {
  const { setSize } = useDynamicIslandSize();

  useEffect(() => {
    if (visible) {
      setSize(SIZE_PRESETS.COMPACT);
    } else {
      setSize(SIZE_PRESETS.EMPTY);
    }
  }, [visible, setSize]);

  if (!visible) return null;

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : '';

  return (
    <DynamicIsland id="scan-island">
      <DynamicContainer className="flex h-full w-full items-center justify-center gap-3 px-4">
        <span className="h-2 w-2 rounded-full bg-green animate-pulse flex-shrink-0" />
        <div className="min-w-0 text-left">
          <DynamicTitle className="text-[11px] font-medium text-green truncate">
            {message}
          </DynamicTitle>
          {shortAddr ? (
            <p className="text-[10px] text-text-muted font-mono truncate">{shortAddr}</p>
          ) : null}
        </div>
      </DynamicContainer>
    </DynamicIsland>
  );
}

export default function ScanIsland({ message, address, visible, className }) {
  return (
    <div className={cn('fixed bottom-6 left-1/2 z-50 -translate-x-1/2 pointer-events-none', className)}>
      <DynamicIslandProvider initialSize={SIZE_PRESETS.EMPTY}>
        <ScanIslandInner message={message} address={address} visible={visible} />
      </DynamicIslandProvider>
    </div>
  );
}
