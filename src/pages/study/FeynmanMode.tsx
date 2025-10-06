import { Atom } from "lucide-react";

import StudyModePlaceholder from "./components/StudyModePlaceholder";

const FeynmanModePage = () => (
  <StudyModePlaceholder
    icon={Atom}
    modeName="Feynman Mode"
    blurb="Feynman Mode will guide you to teach the concept simply, revealing gaps and reinforcing mastery."
    helper="We're assembling interactive teaching workflows—coming soon."
  />
);

export default FeynmanModePage;
