import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (resolvedTheme ?? theme) === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="relative"
    >
      <Sun className={`h-4 w-4 transition-opacity ${isDark ? 'opacity-0' : 'opacity-100'} ${mounted ? '' : 'opacity-0'}`} />
      <Moon className={`absolute h-4 w-4 transition-opacity ${isDark ? 'opacity-100' : 'opacity-0'} ${mounted ? '' : 'opacity-0'}`} />
      <span className="sr-only">Toggle dark mode</span>
    </Button>
  );
};
