// src/components/tour/TourTriggerButton.jsx
import { Compass } from 'lucide-react';

const TourTriggerButton = ({ onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-sm font-medium text-accent-fg bg-accent-soft border border-line-accent rounded-full px-3.5 py-1.5 transition-colors hover:bg-accent-soft-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
  >
    <Compass className="w-4 h-4" />
    Take a tour
  </button>
);

export default TourTriggerButton;
