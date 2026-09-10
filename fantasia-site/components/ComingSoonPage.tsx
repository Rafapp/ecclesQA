import Image from "next/image";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import catalog from "../content/products.json";

export function ComingSoonPage({ productId }: { productId: "magic" | "sorcerer" }) {
  const product = catalog.products.find((entry) => entry.id === productId)!;

  return (
    <main>
      <SiteHeader active={product.id} />
      <section className="coming-soon">
        <div className="coming-soon__icon">
          <Image src={`/products/${product.id}.png`} alt="" width={92} height={92} priority />
        </div>
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <span className="status status-development">{product.statusLabel}</span>
        <LinkCards active={product.id} />
      </section>
      <SiteFooter />
    </main>
  );
}

function LinkCards({ active }: { active: string }) {
  return (
    <div className="small-product-links">
      {catalog.products.filter((product) => product.id !== active).map((product) => (
        <a href={product.path} key={product.id}>
          <span>{product.category}</span>
          <strong>{product.name} →</strong>
        </a>
      ))}
    </div>
  );
}
