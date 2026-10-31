import { createContext, useContext, useEffect, useState } from 'react';

const PageContext = createContext({ title: 'Overview', group: 'Overview' });
const SetPageContext = createContext(() => {});

export function PageMetaProvider({ children }) {
  const [meta, setMeta] = useState({ title: 'Overview', group: 'Overview' });
  return (
    <SetPageContext.Provider value={setMeta}>
      <PageContext.Provider value={meta}>{children}</PageContext.Provider>
    </SetPageContext.Provider>
  );
}

export function usePageMeta(title, group) {
  const setMeta = useContext(SetPageContext);
  useEffect(() => {
    setMeta({ title, group });
  }, [title, group, setMeta]);
}

export function usePageTitle() {
  return useContext(PageContext);
}
