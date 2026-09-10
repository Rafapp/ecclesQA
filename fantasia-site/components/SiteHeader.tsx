import Link from "next/link";
import Image from "next/image";

import catalog from "../content/products.json";

export function SiteHeader({ active }: { active: string }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/wand#home" aria-label={`${catalog.siteName} home`}>
        <span className="wordmark-mark"><Image src="/products/wand.png" alt="" width={26} height={26} /></span>
        <span>{catalog.siteName}</span>
      </Link>
      <nav aria-label="Products">
        {catalog.products.map((product) => (
          <Link className={product.id === active ? "active" : undefined} href={`/wand#${product.id}`} key={product.id}>
            {product.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
