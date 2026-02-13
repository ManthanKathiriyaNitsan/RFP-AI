export function CopyrightFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto py-3 text-center text-xs text-muted-foreground border-t border-border/50">
      © {year} RFP-AI. All rights reserved.
    </footer>
  );
}
