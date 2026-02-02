"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface UserPanelContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const UserPanelContext = createContext<UserPanelContextType | undefined>(undefined);

export function UserPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <UserPanelContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </UserPanelContext.Provider>
  );
}

export function useUserPanel() {
  const context = useContext(UserPanelContext);
  if (context === undefined) {
    throw new Error("useUserPanel must be used within a UserPanelProvider");
  }
  return context;
}
