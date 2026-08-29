import Link from "next/link";

// Kedros logo lockup used across the client and admin panels.
export default function BrandMark({ href = "/", wordmark = true }) {
  return (
    <Link href={href} className="brand-mark" aria-label="Kedros home">
      <img className="brand-symbol-image" src="/assets/kedros-symbol-brand.png" alt="" />
      {wordmark && (
        <img className="brand-wordmark-image" src="/assets/kedros-wordmark-brand.png" alt="Kedros" />
      )}
    </Link>
  );
}
