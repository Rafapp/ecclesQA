import type { Metadata } from "next";

import { ComingSoonPage } from "../../components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Magic | Project Fantasia",
  description: "Magic is the Project Fantasia Windows application, currently in development.",
};

export default function MagicPage() {
  return <ComingSoonPage productId="magic" />;
}
