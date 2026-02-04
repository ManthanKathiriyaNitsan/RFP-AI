import { ToggleTheme } from "@/components/ui/toggle-theme";

export function ThemeToggle() {
  return (
    <ToggleTheme
      animationType="diag-down-right"
      duration={800}
      className="hover:bg-accent"
      aria-label="Toggle theme"
    />
  );
}