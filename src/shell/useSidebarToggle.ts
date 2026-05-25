import { useCallback, useState } from "react";
import { useShortcut } from "./useShortcut";

export type SidebarToggle = {
  visible: boolean;
  setVisible: (v: boolean) => void;
  toggle: () => void;
};

export function useSidebarToggle(defaultVisible = true): SidebarToggle {
  const [visible, setVisible] = useState(defaultVisible);
  const toggle = useCallback(() => setVisible((v) => !v), []);
  useShortcut("[", toggle);
  return { visible, setVisible, toggle };
}
