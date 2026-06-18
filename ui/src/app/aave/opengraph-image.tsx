import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { DEMO_COPY } from "@/lib/demo-copy";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = DEMO_COPY["aave"].description;

export default function Image() {
  return ogCard(DEMO_COPY["aave"].og);
}
