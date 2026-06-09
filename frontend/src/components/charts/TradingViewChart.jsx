import { useEffect, useRef } from 'react';

export default function TradingViewChart({
  symbol = 'ETHUSD',
  interval = '5',
  height = 400,
}) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let timer;
    widgetRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = '';

    function createWidget() {
      if (!containerRef.current) return;
      if (typeof window.TradingView === 'undefined') return;

      const containerId = `tv_chart_${Date.now()}`;
      containerRef.current.id = containerId;

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0F0F12',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: containerId,
        backgroundColor: '#0F0F12',
        gridColor: '#1E1E26',
        overrides: {
          'paneProperties.background': '#0F0F12',
          'paneProperties.backgroundType': 'solid',
          'paneProperties.gridProperties.color': '#1E1E26',
          'scalesProperties.textColor': '#4A4A5E',
          'scalesProperties.fontSize': 11,
        },
        studies_overrides: {},
        disabled_features: [
          'header_symbol_search',
          'header_compare',
          'use_localstorage_for_settings',
        ],
        enabled_features: [
          'hide_last_na_study_output',
        ],
      });
    }

    if (typeof window.TradingView === 'undefined') {
      timer = setTimeout(() => {
        if (typeof window.TradingView !== 'undefined') createWidget();
      }, 1000);
    } else {
      createWidget();
    }

    return () => {
      if (timer) clearTimeout(timer);
      widgetRef.current = null;
    };
  }, [symbol, interval]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px` }}
      className="w-full rounded-b-xl overflow-hidden"
    />
  );
}
