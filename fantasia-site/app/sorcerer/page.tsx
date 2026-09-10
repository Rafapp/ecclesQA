import type { Metadata } from "next";

import { ComingSoonPage } from "../../components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Sorcerer | Project Fantasia",
  description: "Sorcerer is the Project Fantasia server and web dashboard, currently in development.",
};

export default function SorcererPage() {
  return <ComingSoonPage productId="sorcerer" />;
}
