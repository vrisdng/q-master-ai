import { MessageCircle } from "lucide-react";

import StudyModePlaceholder from "./components/StudyModePlaceholder";

const SelfExplanationModePage = () => (
  <StudyModePlaceholder
    icon={MessageCircle}
    modeName="Self-Explanation Mode"
    blurb="Self-Explanation Mode will help you articulate understanding in your own words and receive targeted nudges."
    helper="We're fine-tuning reflective prompts and feedback loops—stay tuned."
  />
);

export default SelfExplanationModePage;
