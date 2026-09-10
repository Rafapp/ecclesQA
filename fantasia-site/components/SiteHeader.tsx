import Link from "next/link";

import catalog from "../content/products.json";

export function SiteHeader({ active }: { active: string }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/wand" aria-label={`${catalog.siteName}: Wand`}>
        <span className="wordmark-mark">F</span>
        <span>{catalog.siteName}</span>
      </Link>
      <nav aria-label="Products">
        {catalog.products.map((product) => (
          <Link className={product.id === active ? "active" : undefined} href={product.path} key={product.id}>
            {product.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
