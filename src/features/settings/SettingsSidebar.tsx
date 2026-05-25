import { NavSection } from "../../ui/sidebar/NavSection";
import { NavItem } from "../../ui/sidebar/NavItem";
import { SETTINGS_CATEGORIES, type SettingsCategory } from "./categories";

type Props = {
  current: SettingsCategory;
  onPick: (next: SettingsCategory) => void;
};

export function SettingsSidebar({ current, onPick }: Props) {
  return (
    <NavSection label="Settings">
      {SETTINGS_CATEGORIES.map(({ id, label, icon: Icon }) => (
        <NavItem
          key={id}
          label={label}
          icon={<Icon size={12} />}
          active={current === id}
          onClick={() => onPick(id)}
        />
      ))}
    </NavSection>
  );
}
