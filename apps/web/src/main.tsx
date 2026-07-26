import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { useThemeStore } from './store/theme';
import './index.css';

const queryClient = new QueryClient();

function Root(): JSX.Element {
  const init = useThemeStore((s) => s.init);
  React.useEffect(() => {
    init();
  }, [init]);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<Root />);
}