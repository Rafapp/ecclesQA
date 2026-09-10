import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Project Fantasia</span>
      <nav aria-label="Footer navigation">
        <Link href="/wand">Wand</Link>
        <Link href="/magic">Magic</Link>
        <Link href="/sorcerer">Sorcerer</Link>
      </nav>
    </footer>
  );
}
